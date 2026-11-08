import { describe, expect, it } from 'vitest';
import { Readable } from 'node:stream';
import { interactiveLessonPolicy } from '@continuum/shared';
import { interactiveHash, parseInteractiveArchive, readInteractiveBytes } from '../src/library/interactive-archive';
import { interactiveHtml, interactiveManifest, interactiveZip } from './interactive-archive.fixture';

describe('interactive ZIP boundary', () => {
  it('reads an executable offline document unchanged, never running its code', async () => {
    await expect(parseInteractiveArchive(await interactiveZip())).resolves.toEqual({ manifest: interactiveManifest, html: interactiveHtml });
    expect((globalThis as Record<string, unknown>).demo).toBeUndefined();
  });
  it.each([
    ['unsupported version', { ...interactiveManifest, schemaVersion: 2 }],
    ['remote entrypoint', { ...interactiveManifest, entrypoint: 'https://foreign.test/demo.html' }],
    ['unknown property', { ...interactiveManifest, execute: true }],
    ['duplicate sections', { ...interactiveManifest, sections: [interactiveManifest.sections[0], interactiveManifest.sections[0]] }],
    ['wrong hash', { ...interactiveManifest, contentSha256: 'a'.repeat(64) }],
  ])('rejects %s', async (_reason, manifest) => {
    await expect(parseInteractiveArchive(await interactiveZip([['manifest.json', JSON.stringify(manifest)], ['lesson.html', interactiveHtml]]))).rejects.toThrow();
  });
  it('rejects absent files, unused files, duplicates and directories', async () => {
    for (const files of [
      [['manifest.json', JSON.stringify(interactiveManifest)]],
      [['manifest.json', JSON.stringify(interactiveManifest)], ['lesson.html', interactiveHtml], ['extra.js', 'alert(1)']],
      [['manifest.json', '{}'], ['manifest.json', '{}']],
      [['manifest.json', '{}'], ['sub/lesson.html', interactiveHtml]],
    ] as Array<Array<[string, string]>>) await expect(parseInteractiveArchive(await interactiveZip(files))).rejects.toThrow();
  });
  it('rejects traversal and symlinks from actual central directory attributes', async () => {
    const archive = await interactiveZip();
    const traversal = Buffer.from(archive.toString('latin1').replaceAll('lesson.html', '../son.html'), 'latin1');
    await expect(parseInteractiveArchive(traversal)).rejects.toThrow();
    const symlink = Buffer.from(archive);
    const central = symlink.indexOf(Buffer.from([0x50, 0x4b, 0x01, 0x02]));
    symlink.writeUInt32LE((0xa1ff << 16) >>> 0, central + 38);
    await expect(parseInteractiveArchive(symlink)).rejects.toThrow();
  });
  it('rejects encrypted entries and oversized declared unpacked files before reading them', async () => {
    for (const mutate of [
      (buffer: Buffer, offset: number) => buffer.writeUInt16LE(buffer.readUInt16LE(offset + 8) | 1, offset + 8),
      (buffer: Buffer, offset: number) => buffer.writeUInt32LE(interactiveLessonPolicy.htmlBytes + 1, offset + 24),
    ]) {
      const buffer = await interactiveZip();
      const offset = buffer.indexOf(Buffer.from([0x50, 0x4b, 0x01, 0x02]));
      mutate(buffer, offset);
      await expect(parseInteractiveArchive(buffer)).rejects.toThrow();
    }
  });
  it('rejects a corrupt ZIP CRC even when document SHA256 still matches', async () => {
    const buffer = await interactiveZip();
    const offset = buffer.indexOf(Buffer.from([0x50, 0x4b, 0x01, 0x02]));
    buffer.writeUInt32LE((buffer.readUInt32LE(offset + 16) + 1) >>> 0, offset + 16);
    await expect(parseInteractiveArchive(buffer)).rejects.toThrow('Контрольная сумма ZIP-записи');
  });
  it('rejects broken ZIP, invalid UTF8 and fragments even with a matching hash', async () => {
    await expect(parseInteractiveArchive(Buffer.from('PKbad'))).rejects.toThrow();
    for (const html of [Buffer.from([0xff]), Buffer.from('<script>alert(1)</script>')]) {
      const manifest = { ...interactiveManifest, contentSha256: interactiveHash(html) };
      await expect(parseInteractiveArchive(await interactiveZip([['manifest.json', JSON.stringify(manifest)], ['lesson.html', html]]))).rejects.toThrow();
    }
  });
  it('bounds incoming/storage streams and checks actual length', async () => {
    await expect(readInteractiveBytes(Readable.from(['ab']), 2)).resolves.toEqual(Buffer.from('ab'));
    await expect(readInteractiveBytes(Readable.from(['ab']), 1)).rejects.toThrow();
    await expect(readInteractiveBytes(Readable.from(['ab']), 3)).rejects.toThrow();
    await expect(readInteractiveBytes(Readable.from([]), interactiveLessonPolicy.zipBytes + 1)).rejects.toThrow();
  });
});
