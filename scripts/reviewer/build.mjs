import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { mkdir, copyFile, mkdtemp, rename, rmdir } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';

const root = fileURLToPath(new URL('../../', import.meta.url));
// Reuse the installed test toolchain; the distributable has no node_modules/runtime dependency.
const workspaceRequire = createRequire(join(root, 'packages/shared/package.json'));
const vitestRequire = createRequire(workspaceRequire.resolve('vitest/package.json'));
const viteRequire = createRequire(vitestRequire.resolve('vite/package.json'));
const { build } = viteRequire('esbuild');
const directory = join(root, 'output/reviewer-client');
await mkdir(directory, { recursive: true, mode: 0o700 });
await build({ entryPoints: [join(root, 'scripts/reviewer/cli.mjs')], outfile: join(directory, 'cli.mjs'), bundle: true, platform: 'node', format: 'esm', target: 'node24', legalComments: 'eof' });
await copyFile(join(root, 'documents/REVIEWER-CLIENT.md'), join(directory, 'REVIEWER-CLIENT.md'));
// Exact two filenames only: never archive credentials, source photos or local configuration.
const staging = await mkdtemp(join(root, 'output/reviewer-archive-'));
const archive = join(staging, 'client.zip');
execFileSync('/usr/bin/zip', ['-j', archive, join(directory, 'cli.mjs'), join(directory, 'REVIEWER-CLIENT.md')], { stdio: 'inherit' });
await rename(archive, join(root, 'output/continuum-reviewer-client.zip'));
await rmdir(staging);
console.log(directory);
