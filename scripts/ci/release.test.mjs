import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { findRelease, fingerprint, isDocumentation, trustedRun } from './release.mjs';

test('only explicit inert documentation skips builds; unknown and runtime paths fail closed', () => {
  for (const path of ['README.md', 'documents/SECURITY.md', 'deploy/README.md']) assert.equal(isDocumentation(path), true);
  for (const path of ['AGENTS.md', 'apps/web/content.mdx', 'documents/tool.mjs', '.github/workflows/ci.yml', 'pnpm-lock.yaml', 'deploy/scripts/deploy-on-vps.sh']) assert.equal(isDocumentation(path), false);
});
test('docs preserve a release fingerprint while a runtime edit invalidates it', () => {
  const cwd = process.cwd(), directory = mkdtempSync(join(tmpdir(), 'release-fingerprint-'));
  const git = (...args) => execFileSync('git', args, { stdio: 'pipe' });
  try {
    process.chdir(directory);
    git('init');
    const commit = () => { git('add', '--', 'app.js', 'README.md'); git('-c', 'user.name=Test', '-c', 'user.email=test@example.invalid', 'commit', '-m', 'fixture'); };
    writeFileSync('app.js', 'original'); writeFileSync('README.md', 'first'); commit();
    const first = fingerprint();
    writeFileSync('README.md', 'updated docs'); commit();
    assert.equal(fingerprint(), first);
    writeFileSync('app.js', 'changed runtime'); commit();
    assert.notEqual(fingerprint(), first);
    assert.throws(() => fingerprint('--all'));
  } finally { process.chdir(cwd); rmSync(directory, { recursive: true, force: true }); }
});
const run = { conclusion: 'success', path: '.github/workflows/ci.yml', event: 'pull_request', repository: { full_name: 'inakado/continuum' }, head_repository: { full_name: 'inakado/continuum' } };
const jobs = [{ name: 'quality', conclusion: 'success' }, { name: 'security', conclusion: 'success' }];
test('reuse requires both successful gates in the trusted repository and workflow', () => {
  assert.equal(trustedRun(run, jobs, 'inakado/continuum'), true);
  for (const conclusion of ['failure', 'cancelled', null]) assert.equal(trustedRun({ ...run, conclusion }, jobs, 'inakado/continuum'), false);
  assert.equal(trustedRun(run, [jobs[0]], 'inakado/continuum'), false);
  assert.equal(trustedRun(run, [jobs[0], { ...jobs[1], conclusion: 'skipped' }], 'inakado/continuum'), false);
  assert.equal(trustedRun({ ...run, path: '.github/workflows/other.yml' }, jobs, 'inakado/continuum'), false);
  assert.equal(trustedRun({ ...run, head_repository: { full_name: 'attacker/fork' } }, jobs, 'inakado/continuum'), false);
});
test('unrelated or expired artifacts never skip quality checks even if the API returns them', () => {
  const fp = 'a'.repeat(64);
  const artifact = { name: `release-${fp}`, expired: false, id: 3, workflow_run: { id: 2 } };
  const request = path => path.includes('/artifacts?')
    ? { artifacts: [{ ...artifact, name: 'unrelated' }, { ...artifact, expired: true }, artifact] }
    : path.endsWith('/jobs?per_page=100') ? { jobs } : { ...run, id: 2 };
  assert.deepEqual(findRelease('inakado/continuum', fp, request), { runId: 2, artifactId: 3, name: `release-${fp}` });
  assert.equal(findRelease('inakado/continuum', fp, () => ({ artifacts: [{ ...artifact, name: 'wrong' }] })), null);
  assert.throws(() => findRelease('inakado/continuum', fp, () => { throw Error('API unavailable'); }));
});
