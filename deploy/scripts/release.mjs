#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { chmodSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { findRelease, fingerprint, trustedRun } from '../../scripts/ci/release.mjs';

const repository = 'inakado/continuum';
const call = (program, args, options = {}) => execFileSync(program, args, { stdio: 'inherit', ...options });
const json = path => JSON.parse(call('gh', ['api', path], { stdio: 'pipe', encoding: 'utf8' }));
call('git', ['fetch', 'origin', 'main']);
const requested = process.argv[2] || 'origin/main';
if (requested !== 'origin/main' && !/^[a-f0-9]{40}$/.test(requested)) throw Error('Pass a full commit SHA or omit it for main');
const revision = call('git', ['rev-parse', requested], { stdio: 'pipe', encoding: 'utf8' }).trim();
call('git', ['merge-base', '--is-ancestor', revision, 'origin/main']);
const runs = json(`repos/${repository}/actions/workflows/ci.yml/runs?head_sha=${revision}&per_page=20`).workflow_runs;
const gate = runs.find(run => ['push', 'workflow_dispatch'].includes(run.event));
if (!gate || !trustedRun(gate, json(`repos/${repository}/actions/runs/${gate.id}/jobs?per_page=100`).jobs, repository)) {
  throw Error('The latest main CI for this exact revision must finish quality and security successfully');
}
const fp = fingerprint(revision);
const artifact = findRelease(repository, fp);
if (!artifact) throw Error('No unexpired verified release. Run CI manually; building on the VPS is disabled');
const target = process.env.SSH_TARGET || 'continuum-vps';
if (!/^[a-zA-Z0-9_.@-]+$/.test(target) || target.startsWith('-')) throw Error('Invalid SSH target');
const prefix = process.env.DEPLOY_USER === 'deploy' ? 'bash -s --' : 'sudo -iu deploy bash -s --';
const remote = script => call('ssh', ['-o', 'BatchMode=yes', '-o', 'StrictHostKeyChecking=yes', target, `${prefix} ${revision} ${fp}`], { input: script, stdio: ['pipe', 'inherit', 'inherit'] });
const temp = mkdtempSync(join(tmpdir(), 'continuum-release-'));
const prepare = process.env.PREPARE_ONLY === 'yes' ? 'yes' : 'no';
let incoming = false;
try {
  call('gh', ['run', 'download', String(artifact.runId), '--repo', repository, '--name', artifact.name, '--dir', temp]);
  remote('set -euo pipefail\nmkdir -p "/home/deploy/continuum-incoming/$2"\n');
  incoming = true;
  const files = ['api-image.tar.gz', 'web.tar.gz', 'release.json', 'SHA256SUMS'].map(name => join(temp, name));
  for (const file of files) chmodSync(file, 0o644);
  call('scp', ['-p', '-o', 'BatchMode=yes', '-o', 'StrictHostKeyChecking=yes', '--', ...files, `${target}:/home/deploy/continuum-incoming/${fp}/`]);
  const migrations = process.env.MIGRATIONS_APPROVED === 'yes' ? 'yes' : 'no';
  const backup = process.env.BACKUP_CONFIRMED === 'yes' ? 'yes' : 'no';
  remote(`set -euo pipefail
cd /srv/continuum
[ -z "$(git status --short)" ]
git fetch origin "$1"
git checkout --detach "$1"
[ "$(node scripts/ci/release.mjs fingerprint)" = "$2" ]
APP_DOMAIN=vl-physics.ru PREPARE_ONLY=${prepare} MIGRATIONS_APPROVED=${migrations} BACKUP_CONFIRMED=${backup} bash deploy/scripts/deploy-on-vps.sh "/home/deploy/continuum-incoming/$2"
if [ '${prepare}' != yes ]; then rm -rf -- "/home/deploy/continuum-incoming/$2"; fi
`);
  incoming = false;
} finally {
  if (incoming && prepare !== 'yes') {
    try { remote('set -euo pipefail\nrm -rf -- "/home/deploy/continuum-incoming/$2"\n'); }
    catch { console.error('Incoming bundle cleanup failed; remove the named fingerprint directory after reconnecting'); }
  }
  rmSync(temp, { recursive: true, force: true });
}
