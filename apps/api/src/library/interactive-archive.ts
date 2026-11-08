import { createHash } from 'node:crypto';
import { TextDecoder } from 'node:util';
import { crc32 } from 'node:zlib';
import { fromBuffer, type Entry, type ZipFile } from 'yauzl';
import { BadRequestException } from '@nestjs/common';
import { InteractiveLessonManifestSchema, interactiveLessonPolicy as limits } from '@continuum/shared';

export function interactivePackageError(message = 'Проверьте manifest.json и самодостаточный lesson.html в ZIP.'): never {
  throw new BadRequestException({ code: 'INTERACTIVE_PACKAGE_INVALID', message });
}
export const interactiveHash = (value: Buffer | string) => createHash('sha256').update(value).digest('hex');

export function assertInteractiveSize(size: number) {
  if (!Number.isSafeInteger(size) || size <= 0 || size > limits.zipBytes) interactivePackageError('ZIP интерактивной лекции должен быть не больше 16 МиБ.');
}

/** Bounded in-memory parsing. Nothing is extracted, imported or executed by the server. */
async function unzip(bytes: Buffer): Promise<Map<string, Buffer>> {
  if (!bytes.length || bytes.length > limits.zipBytes) interactivePackageError('ZIP интерактивной лекции должен быть не больше 16 МиБ.');
  return new Promise((resolve, reject) => {
    let archive: ZipFile | undefined;
    let stopped = false;
    const stop = (error: unknown) => {
      if (stopped) return;
      stopped = true;
      archive?.close();
      reject(error instanceof BadRequestException ? error : new BadRequestException({ code: 'INTERACTIVE_PACKAGE_INVALID', message: 'ZIP повреждён или не поддерживается.' }));
    };
    fromBuffer(bytes, { lazyEntries: true, validateEntrySizes: true, strictFileNames: true }, (error, opened) => {
      if (error || !opened) { stop(error); return; }
      archive = opened;
      const files = new Map<string, Buffer>();
      let entries = 0;
      opened.on('error', stop);
      opened.on('end', () => { if (!stopped) resolve(files); });
      opened.on('entry', (entry: Entry) => {
        void (async () => {
          const path = entry.fileName;
          if (++entries > limits.files || !['manifest.json', 'lesson.html'].includes(path) || files.has(path)) interactivePackageError('В ZIP допускаются только manifest.json и lesson.html, без повторов и каталогов.');
          const mode = (entry.externalFileAttributes >>> 16) & 0xf000;
          if ((mode && mode !== 0x8000) || (entry.generalPurposeBitFlag & 1)) interactivePackageError('Ссылки, специальные и зашифрованные файлы запрещены.');
          if (entry.compressionMethod !== 0 && entry.compressionMethod !== 8) interactivePackageError('Неподдерживаемое сжатие ZIP.');
          const maxBytes = path === 'manifest.json' ? limits.manifestBytes : limits.htmlBytes;
          if (entry.uncompressedSize > maxBytes) interactivePackageError('Распакованный файл превышает допустимый размер.');
          opened.openReadStream(entry, (streamError, stream) => {
            if (streamError || !stream) { stop(streamError); return; }
            void (async () => {
              const chunks: Buffer[] = [];
              let size = 0;
              for await (const chunk of stream) {
                size += chunk.length;
                if (size > maxBytes) { stream.destroy(); interactivePackageError('Распакованный файл превышает допустимый размер.'); }
                chunks.push(Buffer.from(chunk));
              }
              const bytes = Buffer.concat(chunks);
              if (crc32(bytes) !== entry.crc32) interactivePackageError('Контрольная сумма ZIP-записи не совпадает.');
              files.set(path, bytes);
              opened.readEntry();
            })().catch(stop);
          });
        })().catch(stop);
      });
      opened.readEntry();
    });
  });
}

export async function parseInteractiveArchive(bytes: Buffer) {
  const files = await unzip(bytes);
  const decode = (path: string) => {
    const file = files.get(path);
    if (!file) interactivePackageError(`В ZIP отсутствует ${path}.`);
    try { return new TextDecoder('utf-8', { fatal: true }).decode(file); }
    catch { return interactivePackageError(`${path} должен использовать UTF-8.`); }
  };
  let json: unknown;
  try { json = JSON.parse(decode('manifest.json')); }
  catch (error) { if (error instanceof BadRequestException) throw error; return interactivePackageError('Некорректный JSON манифеста.'); }
  const parsed = InteractiveLessonManifestSchema.safeParse(json);
  if (!parsed.success) interactivePackageError('Неподдерживаемый формат манифеста интерактивной лекции.');
  const htmlBytes = files.get('lesson.html');
  const html = decode('lesson.html');
  if (!htmlBytes || interactiveHash(htmlBytes) !== parsed.data.contentSha256) interactivePackageError('Контрольная сумма lesson.html не совпадает с манифестом.');
  if (!/^\s*(?:<!doctype\s+html[^>]*>\s*)?<html[\s>]/i.test(html) || html.includes('\0')) interactivePackageError('Ожидается полный HTML-документ без нулевых байтов.');
  return { manifest: parsed.data, html };
}

export async function readInteractiveBytes(stream: NodeJS.ReadableStream, expectedSize?: number): Promise<Buffer> {
  if (expectedSize !== undefined) assertInteractiveSize(expectedSize);
  let size = 0;
  const chunks: Buffer[] = [];
  for await (const chunk of stream as AsyncIterable<Buffer | Uint8Array | string>) {
    const bytes = Buffer.from(chunk);
    size += bytes.length;
    if (size > limits.zipBytes || (expectedSize !== undefined && size > expectedSize)) interactivePackageError('Размер ZIP превышает заявленный или допустимый.');
    chunks.push(bytes);
  }
  if (expectedSize !== undefined && size !== expectedSize) interactivePackageError('Загрузка ZIP не завершена.');
  return Buffer.concat(chunks);
}
