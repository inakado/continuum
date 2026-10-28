#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
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
if (!gate || !trustedRun(gate, json(`repos/${repository}/actions/runs/${gate.id}/jobs?per_page=100`).jobs, repository, revision)) {
  throw Error('The latest main CI for this exact revision must finish quality and security successfully');
}
const fp = fingerprint(revision);
if (!findRelease(repository, fp)) throw Error('No current source verification; run CI manually before deploying');
const target = process.env.SSH_TARGET || 'continuum-vps';
if (!/^[a-zA-Z0-9_.@-]+$/.test(target) || target.startsWith('-')) throw Error('Invalid SSH target');
const prefix = process.env.DEPLOY_USER === 'deploy' ? 'bash -s --' : 'sudo -iu deploy bash -s --';
const remote = script => call('ssh', ['-o', 'BatchMode=yes', '-o', 'StrictHostKeyChecking=yes', target, `${prefix} ${revision} ${fp}`], { input: script, stdio: ['pipe', 'inherit', 'inherit'] });
const prepare = process.env.PREPARE_ONLY === 'yes' ? 'yes' : 'no';
const migrations = process.env.MIGRATIONS_APPROVED === 'yes' ? 'yes' : 'no';
const backup = process.env.BACKUP_CONFIRMED === 'yes' ? 'yes' : 'no';
remote(`set -euo pipefail
cd /srv/continuum
[ -z "$(git status --short)" ]
git fetch origin "$1"
git checkout --detach "$1"
[ "$(node scripts/ci/release.mjs fingerprint)" = "$2" ]
APP_DOMAIN=vl-physics.ru PREPARE_ONLY=${prepare} MIGRATIONS_APPROVED=${migrations} BACKUP_CONFIRMED=${backup} bash deploy/scripts/deploy-on-vps.sh
`);
