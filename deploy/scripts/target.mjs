import { readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';

export function productionApiUrl(domain) {
  if (typeof domain !== 'string' || domain.length > 253 ||
      !/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z][a-z0-9-]{1,62}$/.test(domain)) {
    throw Error('APP_DOMAIN must be a lowercase public hostname, without scheme, port or path');
  }
  return `https://${domain}/api`;
}

export function deploymentTarget(environment = process.env) {
  const file = environment.DEPLOY_CONFIG || 'deploy/env/target.env';
  let saved = {};
  try { saved = parseEnv(readFileSync(file, 'utf8')); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  const config = { ...saved, ...environment };
  productionApiUrl(config.APP_DOMAIN);
  const target = config.SSH_TARGET;
  if (!target || !/^[a-zA-Z0-9_][a-zA-Z0-9_.@-]*$/.test(target)) throw Error('SSH_TARGET is required and must be an SSH alias or user@host');
  const appDir = config.APP_DIR || '/srv/continuum';
  if (!/^\/[a-zA-Z0-9_./-]+$/.test(appDir) || appDir.split('/').includes('..')) throw Error('APP_DIR must be an absolute path without spaces or parent segments');
  return { domain: config.APP_DOMAIN, target, appDir };
}

export const shellQuote = value => "'" + value.replaceAll("'", "'\\''") + "'";
