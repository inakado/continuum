import { createHash } from 'node:crypto';
import { TextDecoder } from 'node:util';
import { fromBuffer, type Entry, type ZipFile } from 'yauzl';
import { imageSize } from 'image-size';
import { AssessmentPackageManifestSchema, AssessmentPackageTaskSchema, assessmentImagePath, assessmentMarkdownImages, parseAssessmentMarkdown, type AssessmentPackageTask } from '@continuum/shared';
import { assessmentPolicy as limits } from './assessment-policy';

export type ArchiveImage = { path: string; bytes: Buffer; hash: string; contentType: string };
export type ArchiveTask = { task: AssessmentPackageTask; statement: string; solution: string | null; images: ArchiveImage[]; hash: string };
export class AssessmentArchiveError extends Error {
  constructor(public readonly issues: { path: string; message: string }[]) { super(issues[0]?.message ?? 'Некорректный пакет.'); }
}
function fail(path: string, message: string): never { throw new AssessmentArchiveError([{ path, message }]); }
export const assessmentHash = (value: string | Buffer) => createHash('sha256').update(value).digest('hex');
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`).join(',')}}`;
  return JSON.stringify(value);
}
async function unzip(bytes: Buffer) {
  if (bytes.length > limits.zipBytes) fail('', 'ZIP превышает 25 МБ.');
  return new Promise<Map<string, Buffer>>((resolve, reject) => {
    let archive: ZipFile | undefined;
    const stop = (reason: unknown) => { archive?.close(); reject(reason instanceof AssessmentArchiveError ? reason : new AssessmentArchiveError([{ path: '', message: 'Не удалось прочитать ZIP. Архив повреждён или не поддерживается.' }])); };
    fromBuffer(bytes, { lazyEntries: true, validateEntrySizes: true, strictFileNames: true }, (error, opened) => {
      if (error || !opened) { stop(error); return; }
      archive = opened;
      const files = new Map<string, Buffer>();
      const paths = new Set<string>();
      let total = 0; let unpackedBytes = 0;
      opened.on('error', stop);
      opened.on('end', () => resolve(files));
      opened.on('entry', (entry: Entry) => {
        void (async () => {
          const name = entry.fileName;
          if (++total > limits.files) fail(name, 'В архиве слишком много файлов и каталогов.');
          if (!/^[A-Za-z0-9._/-]+$/.test(name) || name.split('/').some((part) => part === '..' || part === '.') || name.startsWith('/') || paths.has(name.toLowerCase())) fail(name, 'Небезопасный или повторяющийся путь в архиве.');
          paths.add(name.toLowerCase());
          const unixMode = (entry.externalFileAttributes >>> 16) & 0xf000;
          if (unixMode === 0xa000 || (unixMode && unixMode !== 0x8000 && unixMode !== 0x4000) || entry.generalPurposeBitFlag & 1) fail(name, 'Ссылки, специальные и зашифрованные файлы запрещены.');
          if (name.endsWith('/')) { opened.readEntry(); return; }
          if (entry.uncompressedSize > limits.fileBytes) fail(name, 'Файл превышает 4 МБ.');
          opened.openReadStream(entry, (streamError, stream) => {
            if (streamError || !stream) { stop(streamError); return; }
            void (async () => {
              const chunks: Buffer[] = []; let size = 0;
              for await (const chunk of stream) {
                size += chunk.length;
                if (size > limits.fileBytes) { stream.destroy(); fail(name, 'Файл превышает 4 МБ.'); }
                chunks.push(Buffer.from(chunk));
              }
              if (unpackedBytes + size > limits.unpackedBytes) fail(name, 'Объём распакованного пакета превышает 80 МБ.');
              unpackedBytes += size;
              files.set(name, Buffer.concat(chunks)); opened.readEntry();
            })().catch(stop);
          });
        })().catch(stop);
      });
      opened.readEntry();
    });
  });
}

export async function parseAssessmentArchive(bytes: Buffer) {
  const files = await unzip(bytes);
  const text = (path: string) => {
    const value = files.get(path);
    if (!value) return fail(path, 'Обязательный файл отсутствует.');
    if (value.length > limits.textBytes) fail(path, 'Текстовый файл превышает 256 КБ.');
    try { return new TextDecoder('utf-8', { fatal: true }).decode(value).replace(/^\uFEFF/, ''); } catch { return fail(path, 'Ожидается UTF-8.'); }
  };
  const json = (path: string): unknown => { try { return JSON.parse(text(path)); } catch (error) { if (error instanceof AssessmentArchiveError) throw error; return fail(path, 'Некорректный JSON.'); } };
  const parsed = AssessmentPackageManifestSchema.safeParse(json('manifest.json'));
  if (!parsed.success) return fail('manifest.json', 'Проверьте формат, версию и уникальные идентификаторы задач.');
  const manifest = parsed.data;
  const allowed = new Set(['manifest.json']);
  const tasks: ArchiveTask[] = [];
  const issues: { path: string; message: string }[] = [];
  for (const id of manifest.tasks) {
    const prefix = `tasks/${id}/`;
    try {
      const input = AssessmentPackageTaskSchema.safeParse(json(`${prefix}task.json`));
      if (!input.success) fail(`${prefix}task.json`, `Проверьте поля и ключ ответа: ${input.error.issues.map((issue) => issue.path.join('.')).join(', ')}.`);
      const task = input.data;
      if (task.id !== id) fail(`${prefix}task.json`, 'ID задания не совпадает с именем папки.');
      const statement = text(`${prefix}statement.md`);
      if (!statement.trim()) fail(`${prefix}statement.md`, 'Условие не может быть пустым.');
      const solution = files.has(`${prefix}solution.md`) ? text(`${prefix}solution.md`) : null;
      const fragments = [{ path: 'statement.md', text: statement }, ...(solution ? [{ path: 'solution.md', text: solution }] : []),
        ...('options' in task ? task.options.map((option, index) => ({ path: `task.json/options/${index}/content`, text: option.content })) : []),
        ...('rows' in task ? task.rows.map((row, index) => ({ path: `task.json/rows/${index}/content`, text: row.content })) : [])];
      const refs = new Set(fragments.flatMap((fragment) => {
        try { return assessmentMarkdownImages(parseAssessmentMarkdown(fragment.text)); }
        catch (error) { return fail(`${prefix}${fragment.path}`, error instanceof Error ? error.message : 'Некорректный Markdown.'); }
      }));
      const images: ArchiveImage[] = [];
      for (const path of [...refs].sort()) {
        const image = files.get(`${prefix}${path}`);
        if (!image) fail(`${prefix}${path}`, 'Рисунок, указанный в тексте, отсутствует.');
        const dimensions = imageSize(image);
        const ext = path.split('.').pop()?.toLowerCase();
        const expected = ext === 'jpg' || ext === 'jpeg' ? 'jpg' : ext;
        if (!assessmentImagePath.test(path) || dimensions.type !== expected || !dimensions.width || !dimensions.height || dimensions.width * dimensions.height > limits.imagePixels) fail(`${prefix}${path}`, 'Тип или размеры рисунка не соответствуют ограничениям.');
        images.push({ path, bytes: image, hash: assessmentHash(image), contentType: `image/${expected === 'jpg' ? 'jpeg' : expected}` });
        allowed.add(`${prefix}${path}`);
      }
      allowed.add(`${prefix}task.json`); allowed.add(`${prefix}statement.md`);
      if (solution !== null) allowed.add(`${prefix}solution.md`);
      tasks.push({ task, statement, solution, images, hash: assessmentHash(canonical({ task, statement, solution, images: images.map(({ path, hash }) => ({ path, hash })) })) });
    } catch (error) {
      issues.push(...(error instanceof AssessmentArchiveError ? error.issues : [{ path: prefix, message: error instanceof Error ? error.message : 'Не удалось прочитать задачу.' }]));
    }
  }
  if (!issues.length) for (const path of files.keys()) if (!allowed.has(path)) issues.push({ path, message: 'Файл не используется манифестом или условием. Уберите его из пакета.' });
  if (issues.length) throw new AssessmentArchiveError(issues);
  return { manifest, tasks };
}
