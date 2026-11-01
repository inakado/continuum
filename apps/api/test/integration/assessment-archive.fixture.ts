import { randomUUID } from 'node:crypto';
import { ZipFile } from 'yazl';
import { parseAssessmentArchive } from '../../src/assessment-bank/assessment-archive';

// Published examples are reused by several suites; their global IDs must not
// collide with another suite or with manually imported local development data.
export const fixturePrefix = `qa-${randomUUID().slice(0, 8)}`;
export const fixtureId = (id: string) => `${fixturePrefix}-${id}`;
export async function isolatedArchive(bytes: Buffer) {
  const parsed = await parseAssessmentArchive(bytes);
  const zip = new ZipFile();
  zip.addBuffer(Buffer.from(JSON.stringify({ ...parsed.manifest, tasks: parsed.tasks.map(entry => fixtureId(entry.task.id)) })), 'manifest.json');
  for (const entry of parsed.tasks) {
    const id = fixtureId(entry.task.id), prefix = `tasks/${id}/`;
    zip.addBuffer(Buffer.from(JSON.stringify({ ...entry.task, id })), `${prefix}task.json`);
    zip.addBuffer(Buffer.from(entry.statement), `${prefix}statement.md`);
    if (entry.solution !== null) zip.addBuffer(Buffer.from(entry.solution), `${prefix}solution.md`);
    for (const image of entry.images) zip.addBuffer(image.bytes, `${prefix}${image.path}`);
  }
  zip.end(); const chunks: Buffer[] = [];
  for await (const chunk of zip.outputStream) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks);
}
