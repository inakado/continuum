import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { appendFileSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const docs = new Set(['README.md', 'DESIGN.md', 'PRODUCT.md', 'CONTEXT.md', 'design-qa.md', 'deploy/README.md']);
export const isDocumentation = path => docs.has(path) || /^documents\/.*\.md$/.test(path);
const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim();
export function fingerprint(ref = 'HEAD') {
  if (ref !== 'HEAD' && !/^[a-f0-9]{40}$/.test(ref)) throw Error('Expected an immutable Git revision');
  const entries = execFileSync('git', ['ls-tree', '-rz', '--full-tree', ref]).toString().split('\0').filter(Boolean);
  return createHash('sha256').update(entries.filter(entry => !isDocumentation(entry.slice(entry.indexOf('\t') + 1))).join('\0')).digest('hex');
}
export function docsOnly(base, head = 'HEAD') {
  if (!/^[a-f0-9]{40}$/.test(base) || /^0+$/.test(base)) return false;
  const paths = execFileSync('git', ['diff', '--name-only', '-z', base, head]).toString().split('\0').filter(Boolean);
  return paths.length > 0 && paths.every(isDocumentation);
}
const api = path => JSON.parse(execFileSync('gh', ['api', path], { encoding: 'utf8' }));
export function trustedRun(run, jobs, repository) {
  return run.conclusion === 'success' && run.path === '.github/workflows/ci.yml'
    && run.head_repository?.full_name === repository && run.repository?.full_name === repository
    && ['pull_request', 'push', 'workflow_dispatch'].includes(run.event)
    && ['quality', 'security'].every(name => jobs.some(job => job.name === name && job.conclusion === 'success'));
}
export function findRelease(repository, sourceFingerprint, request = api) {
  if (!/^[\w.-]+\/[\w.-]+$/.test(repository) || !/^[a-f0-9]{64}$/.test(sourceFingerprint)) throw Error('Invalid release identity');
  const name = `release-${sourceFingerprint}`;
  const artifacts = request(`repos/${repository}/actions/artifacts?name=${name}&per_page=100`).artifacts;
  for (const artifact of artifacts.filter(a => a.name === name && !a.expired).slice(0, 10)) {
    const run = request(`repos/${repository}/actions/runs/${artifact.workflow_run.id}`);
    const jobs = request(`repos/${repository}/actions/runs/${run.id}/jobs?per_page=100`).jobs;
    if (trustedRun(run, jobs, repository)) return { runId: run.id, artifactId: artifact.id, name: artifact.name };
  }
  return null;
}
function output(values) {
  for (const [key, value] of Object.entries(values)) {
    const line = `${key}=${value}\n`;
    if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, line);
    else process.stdout.write(line);
  }
}
export function manifest(directory, imageId) {
  const hash = file => createHash('sha256').update(readFileSync(file)).digest('hex');
  const migrations = readdirSync('apps/api/prisma/migrations', { withFileTypes: true }).filter(d => d.isDirectory()).map(d => ({
    name: d.name, checksum: hash(`apps/api/prisma/migrations/${d.name}/migration.sql`),
  })).sort((a, b) => a.name.localeCompare(b.name));
  const fp = fingerprint();
  if (!/^sha256:[a-f0-9]{64}$/.test(imageId)) throw Error('Invalid API image digest');
  const release = { schemaVersion: 1, revision: git('rev-parse', 'HEAD'), fingerprint: fp,
    apiImage: `continuum-release-api:${fp}`, apiImageId: imageId,
    webApiBaseUrl: process.env.NEXT_PUBLIC_API_BASE_URL, migrations };
  if (release.webApiBaseUrl !== 'https://vl-physics.ru/api') throw Error('Release must use the production API URL');
  writeFileSync(resolve(directory, 'release.json'), JSON.stringify(release, null, 2) + '\n');
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const [command, ...args] = process.argv.slice(2);
  if (command === 'fingerprint') console.log(fingerprint(args[0]));
  else if (command === 'scope') output({ docs_only: docsOnly(args[0] || ''), fingerprint: fingerprint() });
  else if (command === 'reuse') {
    const found = findRelease(process.env.GITHUB_REPOSITORY, fingerprint());
    output({ reused: Boolean(found), run_id: found?.runId || '' });
  } else if (command === 'manifest') manifest(args[0], args[1]);
  else throw Error('Unknown release command');
}
