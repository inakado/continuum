import { ZipFile } from 'yazl';
import { interactiveHash } from '../src/library/interactive-archive';
export const interactiveHtml = '<!doctype html><html lang="ru"><head><meta charset="utf-8"></head><body><h1>Кинематика</h1><script>window.demo = true;</script></body></html>';
export const interactiveManifest = { schemaVersion: 1, lessonId: 'kin-01', title: 'Кинематика', entrypoint: 'lesson.html', contentSha256: interactiveHash(interactiveHtml), sections: [{ id: 'kinematics', title: 'Кинематика' }], questions: [] };
export async function interactiveZip(files: Array<[string, Buffer | string]> = [['manifest.json', JSON.stringify(interactiveManifest)], ['lesson.html', interactiveHtml]]) {
  const archive = new ZipFile();
  for (const [name, value] of files) archive.addBuffer(Buffer.from(value), name);
  archive.end();
  const chunks: Buffer[] = [];
  for await (const chunk of archive.outputStream) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks);
}
