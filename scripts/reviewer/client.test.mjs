import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { apiClient, normalizeOrigin, checkConnection, keychainArguments, saveOperation, downloadSolution } from './client.mjs';

const id = '11111111-1111-4111-8111-111111111111';
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const source = { id, assignmentId: id, recipientId: id, versionId: id, taskId: id, number: 1, title: 'Задача', statement: 'Условие', maxPoints: 2, source: null, sourceRevision: 1, locked: false, review: null, publishedRevision: null, photos: [{ id, contentType: 'image/png', sizeBytes: 3, sha256: hash('abc'), downloadPath: `/reviewer/v1/solutions/${id}/photos/${id}?sourceRevision=1` }], images: [{ name: 'images/chart.png', downloadPath: `/reviewer/v1/solutions/${id}/images/chart.png` }] };

test('origin: HTTPS production and explicit local dev only', () => {
  assert.equal(normalizeOrigin('https://example.test/'), 'https://example.test');
  assert.equal(normalizeOrigin('http://localhost:3000', true), 'http://localhost:3000');
  for (const url of ['http://example.test', 'https://user:secret@example.test', 'https://example.test/api', 'https://example.test?x=1']) assert.throws(() => normalizeOrigin(url));
  assert.throws(() => normalizeOrigin('http://localhost:3000'));
});

test('transport does not forward credentials across origins or follow redirects; errors redact secret', async () => {
  const calls = [];
  const api = apiClient('https://example.test', 'private-token', async (url, options) => { calls.push({ url, options }); return new Response('private-token', { status: 302, headers: { location: 'https://other.test' } }); });
  await assert.rejects(api('/reviewer/v1/me'), /HTTP 302/);
  assert.equal(calls[0].options.redirect, 'error');
  assert.equal(calls[0].url, 'https://example.test/api/reviewer/v1/me');
  assert.equal(calls[0].options.headers.authorization, 'Bearer private-token');
  await assert.rejects(api('https://other.test/reviewer/v1/me'));
  await assert.rejects(api('//other.test/reviewer/v1/me'));
  await assert.rejects(api('/reviewer/v1/../outside'));
  assert.equal(calls.length, 1);
  const failing = apiClient('https://example.test', 'private-token', async () => { throw new Error('private-token'); });
  await assert.rejects(failing('/reviewer/v1/me'), (error) => !error.message.includes('private-token'));
});

test('Keychain secret never enters process arguments, and native prompt is last argument', () => {
  assert.deepEqual(keychainArguments('connect', 'default'), ['add-generic-password', '-a', 'default', '-s', 'ru.continuum.reviewer', '-w']);
  assert.throws(() => keychainArguments('connect', '../bad'));
});

test('operation persists stable UUIDs before network and rejects changed request inputs', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'reviewer-test-'));
  try {
    const path = join(dir, 'operation.json');
    const input = { solutionId: id, sourceRevision: 1, points: 2, sha256: hash('pdf') };
    const first = await saveOperation(path, input);
    const again = await saveOperation(path, input);
    assert.deepEqual(again, first);
    assert.match(first.requestId, /^[a-f0-9-]{36}$/);
    assert.match(first.reportId, /^[a-f0-9-]{36}$/);
    assert.deepEqual(JSON.parse(await readFile(path)), first);
    await assert.rejects(saveOperation(path, { ...input, points: 1 }), /изменились/);
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test('download verifies hashes and retains condition images with manifest; incomplete set is not usable', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'reviewer-test-'));
  try {
    const api = async (path) => path === `/reviewer/v1/solutions/${id}` ? source : new Response(path.includes('/photos/') ? 'abc' : 'chart');
    const path = await downloadSolution(api, id, dir, 'https://example.test');
    const manifest = JSON.parse(await readFile(path));
    assert.equal(manifest.source.sourceRevision, 1);
    assert.equal(await readFile(join(dir, manifest.photos[0].path), 'utf8'), 'abc');
    assert.equal(await readFile(join(dir, manifest.images[0].path), 'utf8'), 'chart');
    const corrupted = async (path) => path === `/reviewer/v1/solutions/${id}` ? source : new Response('bad');
    await assert.rejects(downloadSolution(corrupted, id, join(dir, 'bad'), 'https://example.test'), /SHA-256/);
    await assert.rejects(readFile(join(dir, 'bad', 'source.json')), /ENOENT/);
    const malicious = async () => ({ ...source, images: [{ name: '../escape', downloadPath: 'https://evil.test/file' }] });
    await assert.rejects(downloadSolution(malicious, id, join(dir, 'unsafe'), 'https://example.test'));
  } finally { await rm(dir, { recursive: true, force: true }); }
});


test('connection diagnosis needs no credential, accepts only the reviewer API and does not follow redirects', async () => {
  const calls = [];
  const fetcher = async (url, options) => { calls.push({ url, options }); return new Response('{}', { status: 401, headers: { 'content-type': 'application/json' } }); };
  assert.deepEqual(await checkConnection('https://example.test', '/api', fetcher), { reachable: true, status: 401 });
  assert.equal(calls[0].url, 'https://example.test/api/reviewer/v1/me');
  assert.equal(calls[0].options.headers.authorization, undefined);
  assert.equal(calls[0].options.redirect, 'error');
  await assert.rejects(checkConnection('https://example.test', '/api', async () => new Response('login', { status: 200 })), /HTTP 200/);
});

test('network diagnostics expose only known codes and never include arbitrary errors or secrets', async () => {
  for (const code of ['ENOTFOUND', 'ECONNREFUSED', 'UND_ERR_CONNECT_TIMEOUT', 'CERT_HAS_EXPIRED']) {
    const api = apiClient('https://example.test', 'private-token', async () => { throw new TypeError('private-token', { cause: Object.assign(new Error('private-token'), { code }) }); });
    await assert.rejects(api('/reviewer/v1/me'), error => error.message.includes(code) && !error.message.includes('private-token'));
  }
  const api = apiClient('https://example.test', 'private-token', async () => { throw new Error('private-token', { cause: { code: 'private-token' } }); });
  await assert.rejects(api('/reviewer/v1/me'), error => !error.message.includes('private-token'));
  await assert.rejects(checkConnection('https://example.test', '/api', async () => { throw new DOMException('private-token', 'TimeoutError'); }), /TIMEOUT/);
});


test('invalid pasted credentials fail before fetch without showing their value', () => {
  assert.throws(() => apiClient('https://example.test', ''), /Некорректный ключ/);
  for (const token of ['private-token\nsecond-line', 'кириллица-secret', 'private token']) {
    assert.throws(() => apiClient('https://example.test', token), error => error.message.includes('Некорректный ключ') && !error.message.includes(token || 'private-token'));
  }
});

test('student downloads cannot be written inside a repository, including a symlink alias', async () => {
  const { mkdir, symlink } = await import('node:fs/promises');
  const dir = await mkdtemp(join(tmpdir(), 'reviewer-private-test-'));
  try {
    const repo = join(dir, 'repo'); await mkdir(join(repo, '.git'), {recursive:true});
    await symlink(repo, join(dir, 'alias'));
    let calls = 0;
    const api = async () => { calls++; return source; };
    await assert.rejects(downloadSolution(api, id, join(repo, 'output'), 'https://example.test'), /вне репозитория/);
    await assert.rejects(downloadSolution(api, id, join(dir, 'alias', 'data'), 'https://example.test'), /вне репозитория/);
    assert.equal(calls, 0);
  } finally { await rm(dir, {recursive:true,force:true}); }
});
