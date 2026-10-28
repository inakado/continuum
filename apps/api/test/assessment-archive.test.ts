import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ZipFile } from 'yazl';
import { parseAssessmentArchive } from '../src/assessment-bank/assessment-archive';

async function zip(files: Record<string, string>) {
  const archive = new ZipFile();
  for (const [name, text] of Object.entries(files)) archive.addBuffer(Buffer.from(text), name);
  archive.end();
  const chunks: Buffer[] = [];
  for await (const chunk of archive.outputStream) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks);
}
const manifest = JSON.stringify({ format: 'continuum-assessment-package', version: 1, title: 'Проба', tasks: ['sample'] });
const task = { id: 'sample', title: 'Давление', gradeBand: 'grade_10_11', topicPath: ['МКТ'], maxPoints: 1, source: { provider: 'Авторское', taskNumber: 7 }, type: 'short_number', grading: { answer: '1', absoluteTolerance: 0 } };
const files = { 'manifest.json': manifest, 'tasks/sample/task.json': JSON.stringify(task), 'tasks/sample/statement.md': 'Найдите $p$.' };

describe('assessment archive boundary', () => {
  it('reads the real pilot including source metadata, matching and all images', async () => {
    const bytes = await readFile(resolve(__dirname, '../../../output/assessment-package-pilot-v1.zip'));
    const result = await parseAssessmentArchive(bytes);
    expect(result.manifest.tasks).toHaveLength(6);
    expect(result.tasks[0].task.source).toMatchObject({ provider: 'Школково', externalId: '11121', taskNumber: 86, sectionCode: '7.05', examTaskNumber: 7 });
    expect(result.tasks.flatMap((entry) => entry.images)).toHaveLength(4);
  });
  it('accepts a minimal valid package and gives stable content hashes', async () => {
    const first = await parseAssessmentArchive(await zip(files));
    const second = await parseAssessmentArchive(await zip({ ...files, 'tasks/sample/task.json': JSON.stringify(task, null, 2) }));
    expect(first.tasks[0].hash).toBe(second.tasks[0].hash);
  });
  it('accepts the legacy display formula inside prose without changing saved content', async () => {
    const statement = 'Согласно закону $$x = 18 + 32t - 6t^2,$$ где $t$ — время, найдите $a_x$.';
    await expect(parseAssessmentArchive(await zip({ ...files, 'tasks/sample/statement.md': statement }))).resolves.toMatchObject({ tasks: [{ statement }] });
  });
  it.each(['statement.md', 'solution.md'])('reports the exact file with unmatched math: %s', async (name) => {
    await expect(parseAssessmentArchive(await zip({ ...files, [`tasks/sample/${name}`]: 'Ошибка $x' }))).rejects.toMatchObject({ issues: [{ path: `tasks/sample/${name}`, message: expect.stringContaining('разделителей формул') }] });
  });
  it.each(['options', 'rows'] as const)('validates math in %s content before saving', async (field) => {
    const matching = { ...task, type: 'matching', rows: [{ id: 'a', content: 'A' }, { id: 'b', content: 'B' }], options: [{ id: 'one', content: '1' }, { id: 'two', content: '2' }], grading: { matches: { a: 'one', b: 'two' } } };
    matching[field][0].content = 'Ошибка $$x$';
    await expect(parseAssessmentArchive(await zip({ ...files, 'tasks/sample/task.json': JSON.stringify(matching) }))).rejects.toMatchObject({ issues: [{ path: `tasks/sample/task.json/${field}/0/content`, message: expect.stringContaining('разделителей формул') }] });
  });
  it.each([
    ['raw HTML', '<script>alert(1)</script>'],
    ['remote image', '![x](https://example.com/x.png)'],
    ['missing image', '![x](images/missing.png)'],
    ['TeX loader', '$\\require{html}$'],
  ])('rejects %s before import', async (_label, markdown) => {
    await expect(parseAssessmentArchive(await zip({ ...files, 'tasks/sample/statement.md': markdown }))).rejects.toThrow();
  });
  it('rejects unknown keys, unlisted files, and corrupt ZIP', async () => {
    await expect(parseAssessmentArchive(await zip({ ...files, 'tasks/sample/task.json': JSON.stringify({ ...task, unknown: true }) }))).rejects.toThrow();
    await expect(parseAssessmentArchive(await zip({ ...files, 'extra.txt': 'hidden' }))).rejects.toThrow();
    await expect(parseAssessmentArchive(Buffer.from('not a ZIP'))).rejects.toThrow();
  });
  it('rejects traversal and case-insensitive path collisions', async () => {
    const archive = await zip({ ...files, 'tasks/sample/images/a.png': 'fake' });
    const traversal = Buffer.from(archive.toString('latin1').replaceAll('images/a.png', '../bad/a.png'), 'latin1');
    await expect(parseAssessmentArchive(traversal)).rejects.toThrow();
    await expect(parseAssessmentArchive(await zip({ ...files, 'TASKS/sample/task.json': '{}' }))).rejects.toThrow();
  });
  it('rejects traversal independently of unused-file validation', async () => {
    const archive = await zip(files);
    await expect(parseAssessmentArchive(archive)).resolves.toMatchObject({ tasks: [{ task: { id: 'sample' } }] });
    const traversal = Buffer.from(archive.toString('latin1').replaceAll('tasks/sample/statement.md', '../xx/sample/statement.md'), 'latin1');
    await expect(parseAssessmentArchive(traversal)).rejects.toThrow(/Не удалось прочитать ZIP|Небезопасный/);
  });
});
