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

test('publish keeps files on network loss and cleans exactly the confirmed local review on retry', async () => {
  const root = await mkdtemp(join(tmpdir(), 'reviewer-publish-clean-'));
  const directory = join(root, id, 'job'), origin = 'https://example.test';
  try {
    const source = { id, assignmentId:id, recipientId:id, versionId:id, taskId:id, number:1, title:'Задача', statement:'Условие', maxPoints:2, source:null, sourceRevision:1, locked:false, review:null, publishedRevision:null, photos:[{id, contentType:'image/png',sizeBytes:3,sha256:sha256('abc'),downloadPath:`/reviewer/v1/solutions/${id}/photos/${id}?sourceRevision=1`}],images:[] };
    const manifestPath = await downloadSolution(async path => path.endsWith(id) ? source : new Response('abc'), id, directory, origin);
    const pdfPath = join(directory, 'review.pdf'); await writeFile(pdfPath, '%PDF-1.7 review');
    await writeFile(join(directory, 'evaluation.json'), 'Разбор ученика');
    let reportId, lost = true;
    const publication = {id, publishedAt:'2026-10-31T00:00:00Z', items:[{reviewId:id,reviewRevision:1,solutionId:id,points:2}]};
    const api = async (path, {body}) => {
      if (path.endsWith('/file')) return {id:reportId,solutionId:id,sourceRevision:1,ready:true,sha256:sha256(body),sizeBytes:body.length};
      if (path.includes('/reports/')) {reportId=path.split('/').at(-1);return {};}
      if (path.endsWith('/draft')) return {id, revision:1,sourceRevision:1,points:2,reportId,authorUserId:id,savedAt:'2026-10-31T00:00:00Z'};
      if (lost) {lost=false;throw new Error('response lost after commit');}
      return publication;
    };
    const draft=await uploadDraft(api,{manifestPath,pdfPath,points:2,origin});
    assert.equal(await readFile(pdfPath,'utf8'),'%PDF-1.7 review');
    const input=join(root,'publication.json'); await writeJson(input,{requestId:id,items:[draft.publicationItem]});
    await assert.rejects(publish(api,input,{root,origin}),/response lost/);
    assert.equal(await readFile(join(directory,'photos',id+'.png'),'utf8'),'abc');
    const wrongSite=await publish(api,input,{root,origin:'https://other.test'});
    assert.equal(wrongSite.cleanup.cleaned.length,0);
    assert.equal(await readFile(pdfPath,'utf8'),'%PDF-1.7 review');
    // Changed local input prevents any deletion and is explicitly reported.
    await writeFile(pdfPath,'%PDF-changed');
    assert.equal((await publish(api,input,{root,origin})).cleanup.retained.length,1);
    assert.equal(await readFile(join(directory,'evaluation.json'),'utf8'),'Разбор ученика');
    await writeFile(pdfPath,'%PDF-1.7 review');
    const result=await publish(api,input,{root,origin});
    assert.equal(result.cleanup.retained.length,0);
    assert.equal(result.cleanup.cleaned[0].removedFiles,3);
    await assert.rejects(readFile(pdfPath),/ENOENT/);
    await assert.rejects(readFile(join(directory,'evaluation.json')),/ENOENT/);
    assert.equal(JSON.parse(await readFile(join(directory,'receipt.json'),'utf8')).publicationId,id);
    assert.equal((await publish(api,input,{root,origin})).cleanup.cleaned[0].removedFiles,0);
  } finally {await rm(root,{recursive:true,force:true});}
});
