import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { downloadSolution, sha256, writeJson } from './client.mjs';
import { uploadDraft, publish } from './commands.mjs';

const id = '11111111-1111-4111-8111-111111111111';
test('lost draft response replays the same report, PDF and request; publish uses explicit immutable selection', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'reviewer-command-test-'));
  try {
    const source = { id, assignmentId: id, recipientId: id, versionId: id, taskId: id, number: 1, title: 'Задача', statement: 'Условие', maxPoints: 2, source: null, sourceRevision: 1, locked: false, review: null, publishedRevision: null, photos: [], images: [] };
    const manifestPath = await downloadSolution(async () => source, id, dir, 'https://example.test');
    const pdfPath = join(dir, 'review.pdf');
    await writeFile(pdfPath, '%PDF-1.7\nreport\n%%EOF');
    const writes = [];
    let lost = true;
    let reportId;
    const api = async (path, options) => {
      const body = options.body;
      writes.push({ path, body });
      if (path.endsWith('/file')) return { id: reportId, solutionId: id, sourceRevision: 1, ready: true, sha256: sha256(body), sizeBytes: body.length };
      if (path.startsWith('/reviewer/v1/reports/')) { reportId = path.split('/').at(-1); return {}; }
      if (path.endsWith('/draft')) {
        if (lost) { lost = false; throw new Error('connection lost after server commit'); }
        return { id, revision: 1, sourceRevision: 1, points: body.points, reportId: body.reportId, authorUserId: id, savedAt: '2026-10-18T00:00:00.000Z' };
      }
      return { id: body.requestId, publishedAt: '2026-10-18T00:00:00.000Z', items: [{ reviewId: id, reviewRevision: 1, solutionId: id, points: 2 }] };
    };
    const args = { manifestPath, pdfPath, points: 2, origin: 'https://example.test' };
    await assert.rejects(uploadDraft(api, args), /connection lost/);
    const result = await uploadDraft(api, args);
    assert.deepEqual(writes.slice(0, 3), writes.slice(3, 6));
    assert.equal(JSON.parse(await readFile(result.operationPath)).review.points, 2);
    const publicationPath = join(dir, 'publication.json');
    const body = { requestId: id, items: [result.publicationItem] };
    await writeJson(publicationPath, body);
    await publish(api, publicationPath);
    assert.deepEqual(writes.at(-1).body, body);
    await publish(api, publicationPath);
    assert.deepEqual(writes.at(-1).body, body);
    await writeJson(publicationPath, { requestId: id, items: [] });
    await assert.rejects(publish(api, publicationPath));
    await assert.rejects(uploadDraft(api, { ...args, points: 3 }), /Баллы/);
  } finally { await rm(dir, { recursive: true, force: true }); }
});
