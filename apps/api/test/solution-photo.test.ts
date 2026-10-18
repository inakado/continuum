import { Readable } from 'node:stream';
import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { readSolutionPhoto } from '../src/assessment-assignments/solution-photo';

const photo = readFileSync(new URL('../../../examples/assessment-package/extended-v1/tasks/shkolkovo-14449/images/process.png', import.meta.url));
it('validates the real image and enforces byte, content-type and completeness boundaries', async () => {
  expect(await readSolutionPhoto(Readable.from(photo), 'image/png', String(photo.length))).toMatchObject({ sizeBytes: photo.length, contentType: 'image/png' });
  await expect(readSolutionPhoto(Readable.from(photo), 'image/jpeg')).rejects.toThrow('Не удалось прочитать');
  await expect(readSolutionPhoto(Readable.from('<svg></svg>'), 'image/png')).rejects.toThrow('Не удалось прочитать');
  await expect(readSolutionPhoto(Readable.from(photo), 'image/svg+xml')).rejects.toThrow('JPG');
  await expect(readSolutionPhoto(Readable.from(photo), 'image/png', '10485761')).rejects.toThrow('10 МБ');
  await expect(readSolutionPhoto(Readable.from(Buffer.alloc(10485761)), 'image/png')).rejects.toThrow('10 МБ');
  await expect(readSolutionPhoto(Readable.from(photo), 'image/png', String(photo.length + 1))).rejects.toThrow('не завершена');
});
