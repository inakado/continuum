#!/usr/bin/env node
import { parseArgs } from 'node:util';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { unlink } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { ReviewerMeSchema, ReviewerAssignmentsPageSchema, ReviewerSolutionsPageSchema, ReviewerListQuerySchema } from '../../packages/shared/src/contracts/reviewer.ts';
import { apiClient, downloadSolution, keychain, normalizeApiPrefix, normalizeOrigin, profileName, readJson, sha256, uuid, writeJson } from './client.mjs';
import { publish, publicationStatus, uploadDraft } from './commands.mjs';

const help = `Continuum — локальный проверяющий (Node.js 24+, macOS)
node cli.mjs connect --origin https://example.ru [--profile default] [--dev] [--api-prefix /api]
node cli.mjs status | disconnect [--profile default]
node cli.mjs assignments [--query текст] [--cursor UUID] [--limit 50]
node cli.mjs solutions --assignment UUID [--state unreviewed|draft|stale|published] [--cursor UUID] [--limit 50]
node cli.mjs download --solution UUID
node cli.mjs upload-draft --manifest /path/source.json --pdf /path/review.pdf --points 2 [--operation /path/operation.json]
node cli.mjs publish --input /path/publication.json
node cli.mjs publish --request UUID  (только получить квитанцию)

Каждая команда поддерживает --profile. --points null сохраняет черновик без балла.
Ключ вводит человек только при connect в скрытом запросе macOS. Не вводите ключ в чате или argv.
Публикация требует явного JSON со списком конкретных ревизий; инструкция — REVIEWER-CLIENT.md.`;

function required(options, name) {
  if (!options[name]) throw new Error(`Не указан --${name}.`);
  return options[name];
}
async function main() {
  const { values: options, positionals } = parseArgs({ allowPositionals: true, options: Object.fromEntries(['origin', 'api-prefix', 'profile', 'query', 'cursor', 'limit', 'assignment', 'state', 'solution', 'manifest', 'pdf', 'points', 'operation', 'input', 'request'].map((key) => [key, { type: 'string' }]).concat([['dev', { type: 'boolean' }], ['help', { type: 'boolean' }]])) });
  const [command] = positionals;
  if (options.help || !command) { console.log(help); return; }
  if (positionals.length !== 1) throw new Error('Лишние аргументы. Ключ нельзя передавать аргументом.');
  const profile = profileName(options.profile ?? 'default');
  const root = join(homedir(), 'Library', 'Application Support', 'Continuum Reviewer');
  const configPath = join(root, 'profiles', `${profile}.json`);
  if (command === 'connect') {
    const origin = normalizeOrigin(required(options, 'origin'), options.dev);
    const apiPrefix = normalizeApiPrefix(options['api-prefix'] ?? (options.dev ? '' : '/api'));
    try { await readJson(configPath); throw new Error('Профиль уже подключён. Сначала disconnect; для другого сайта используйте другое имя профиля.'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
    console.log(`Подключение к ${origin}${apiPrefix}. Введите ключ в следующем скрытом запросе macOS, не в чате.`);
    keychain('connect', profile);
    try {
      const me = ReviewerMeSchema.parse(await apiClient(origin, keychain('read', profile), fetch, apiPrefix)('/reviewer/v1/me'));
      await writeJson(configPath, { version: 1, origin, apiPrefix, dev: Boolean(options.dev) });
      console.log(JSON.stringify({ connected: true, profile, ...me }, null, 2));
    } catch (error) { keychain('disconnect', profile); throw error; }
    return;
  }
  if (command === 'disconnect') {
    keychain('disconnect', profile);
    await unlink(configPath).catch((error) => { if (error.code !== 'ENOENT') throw error; });
    console.log('Ключ удалён с этого Mac. Для отзыва серверного ключа используйте кабинет. Локальные работы сохранены.');
    return;
  }
  const config = await readJson(configPath).catch(() => { throw new Error('Нет профиля. Человек должен выполнить connect в терминале.'); });
  const origin = normalizeOrigin(config.origin, config.dev === true);
  const apiPrefix = normalizeApiPrefix(config.apiPrefix);
  const api = apiClient(origin, keychain('read', profile), fetch, apiPrefix);
  let result;
  if (command === 'status') result = ReviewerMeSchema.parse(await api('/reviewer/v1/me'));
  else if (command === 'assignments' || command === 'solutions') {
    const query = ReviewerListQuerySchema.parse({ ...(options.query ? { query: options.query } : {}), ...(options.cursor ? { cursor: options.cursor } : {}), ...(options.limit ? { limit: options.limit } : {}), ...(options.state ? { state: options.state } : {}) });
    const params = new URLSearchParams(Object.entries(query).map(([key, value]) => [key, String(value)]));
    result = command === 'assignments' ? ReviewerAssignmentsPageSchema.parse(await api(`/reviewer/v1/assignments?${params}`)) : ReviewerSolutionsPageSchema.parse(await api(`/reviewer/v1/assignments/${uuid(required(options, 'assignment'))}/solutions?${params}`));
  } else if (command === 'download') {
    const id = uuid(required(options, 'solution'));
    const directory = join(root, 'data', profile, sha256(origin + apiPrefix).slice(0, 16), id, randomUUID());
    result = { manifestPath: await downloadSolution(api, id, directory, origin, apiPrefix) };
  } else if (command === 'upload-draft') {
    const value = required(options, 'points');
    const points = value === 'null' ? null : /^\d+$/.test(value) ? Number(value) : NaN;
    result = await uploadDraft(api, { origin, apiPrefix, manifestPath: resolve(required(options, 'manifest')), pdfPath: resolve(required(options, 'pdf')), points, operationPath: options.operation ? resolve(options.operation) : undefined });
  } else if (command === 'publish') {
    if (Boolean(options.input) === Boolean(options.request)) throw new Error('Укажите либо --input для публикации, либо --request для её квитанции.');
    result = options.request ? await publicationStatus(api, options.request) : await publish(api, resolve(options.input));
  } else throw new Error('Неизвестная команда. Используйте --help.');
  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  // Do not dump request bodies, server messages, stack traces or child process output.
  console.error(error.name === 'ZodError' ? 'Некорректный формат данных. Сверьте файл с инструкцией клиента.' : error.message);
  process.exitCode = 1;
});
