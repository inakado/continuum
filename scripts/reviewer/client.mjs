import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile, rename, open, unlink, realpath, lstat } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { ReviewerSolutionSchema } from '../../packages/shared/src/contracts/reviewer.ts';

export const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
export function uuid(value) {
  if (typeof value !== 'string' || !/^[a-f\d]{8}-[a-f\d]{4}-[1-8][a-f\d]{3}-[89ab][a-f\d]{3}-[a-f\d]{12}$/i.test(value)) throw new Error('Нужен UUID.');
  return value;
}
export function profileName(value) {
  if (!/^[a-zA-Z0-9_-]{1,40}$/.test(value)) throw new Error('Имя профиля: латиница, цифры, дефис, до 40 символов.');
  return value;
}
export function normalizeOrigin(value, dev = false) {
  const url = new URL(value);
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if (url.username || url.password || url.pathname !== '/' || url.search || url.hash || (url.protocol !== 'https:' && !(dev && local && url.protocol === 'http:'))) throw new Error('Нужен HTTPS origin без пути и пароля. HTTP допустим только для localhost с --dev.');
  return url.origin;
}
export function normalizeApiPrefix(value) {
  if (value !== '' && value !== '/api') throw new Error('API prefix может быть только /api или пустым.');
  return value;
}

export function keychainArguments(action, profile) {
  profileName(profile);
  const common = ['-a', profile, '-s', 'ru.continuum.reviewer'];
  if (action === 'connect') return ['add-generic-password', ...common, '-w'];
  if (action === 'read') return ['find-generic-password', ...common, '-w'];
  if (action === 'disconnect') return ['delete-generic-password', ...common];
  throw new Error('Неизвестная операция Keychain.');
}
export function keychain(action, profile, run = spawnSync) {
  if (process.platform !== 'darwin') throw new Error('Клиент поддерживает macOS Keychain; хранение ключа в файле запрещено.');
  if (action === 'connect' && !process.stdin.isTTY) throw new Error('Подключение запускается человеком в интерактивном терминале. Не передавайте ключ агенту.');
  // -w MUST remain last: security itself prompts without echo; no secret in argv/stdin pipe.
  const result = run('/usr/bin/security', keychainArguments(action, profile), { encoding: 'utf8', stdio: action === 'connect' ? 'inherit' : ['ignore', 'pipe', 'pipe'], maxBuffer: 8192 });
  if (result.status !== 0) throw new Error('Keychain: операция не выполнена. Проверьте доступ к Связке ключей и профиль.');
  return action === 'read' ? result.stdout.trim() : undefined;
}

function connectionError(error) {
  const hints = {
    ENOTFOUND: 'Не найден адрес сайта (DNS).', EAI_AGAIN: 'DNS временно недоступен.',
    ECONNREFUSED: 'Сервер отклонил соединение.', ECONNRESET: 'Соединение прервано.', UND_ERR_SOCKET: 'Сетевое соединение закрыто.',
    ENETUNREACH: 'Нет сетевого маршрута к серверу.', EHOSTUNREACH: 'Сервер недоступен по сети.',
    ETIMEDOUT: 'Истекло время соединения.', UND_ERR_CONNECT_TIMEOUT: 'Истекло время соединения.',
    UND_ERR_HEADERS_TIMEOUT: 'Сервер не ответил вовремя.', TIMEOUT: 'Истекло время запроса.',
    CERT_HAS_EXPIRED: 'Истёк срок TLS-сертификата.', UNABLE_TO_VERIFY_LEAF_SIGNATURE: 'Не удалось проверить цепочку TLS-сертификата.',
    UNABLE_TO_GET_ISSUER_CERT_LOCALLY: 'Не найден доверенный центр TLS-сертификата.',
    SELF_SIGNED_CERT_IN_CHAIN: 'Недоверенный TLS-сертификат.', DEPTH_ZERO_SELF_SIGNED_CERT: 'Самоподписанный TLS-сертификат.',
    ERR_TLS_CERT_ALTNAME_INVALID: 'TLS-сертификат не соответствует адресу сайта.',
  };
  const candidates = [error?.cause?.code, ...(Array.isArray(error?.cause?.errors) ? error.cause.errors : []).map(item => item?.code), ...(['TimeoutError', 'AbortError'].includes(error?.name) ? ['TIMEOUT'] : [])];
  const code = candidates.find(value => typeof value === 'string' && Object.hasOwn(hints, value));
  // Never copy fetch messages/headers/causes: they can contain the Authorization value.
  return new Error(code ? `Сетевая ошибка [${code}]. ${hints[code]} Проверьте сеть и повторите команду.` : 'Сетевая ошибка. Проверьте соединение и повторите команду.');
}

export async function checkConnection(origin, apiPrefix = '/api', fetcher = fetch) {
  normalizeOrigin(origin, new URL(origin).protocol === 'http:'); normalizeApiPrefix(apiPrefix);
  let response;
  try { response = await fetcher(`${origin}${apiPrefix}/reviewer/v1/me`, { headers: { accept: 'application/json' }, redirect: 'error', signal: AbortSignal.timeout(15_000) }); }
  catch (error) { throw connectionError(error); }
  await response.body?.cancel();
  if (response.status !== 401 || !response.headers.get('content-type')?.includes('application/json')) throw new Error(`Проверка API: HTTP ${response.status}. Ожидался JSON-ответ 401 без ключа. Проверьте origin и API prefix.`);
  return { reachable: true, status: 401 };
}

export function apiClient(origin, token, fetcher = fetch, apiPrefix = '/api') {
  normalizeApiPrefix(apiPrefix);
  if (typeof token !== 'string' || !/^[\x21-\x7e]{1,512}$/.test(token)) throw new Error('Некорректный ключ: нужны символы скопированного ключа без пробелов и переносов. Повторите connect в Terminal.');
  return async (path, { method = 'GET', body, raw = false, contentType } = {}) => {
    if (typeof path !== 'string' || !path.startsWith('/reviewer/v1/') || /(?:\.\.|\\|#)/.test(path)) throw new Error('Недопустимый путь API.');
    const url = new URL(`${apiPrefix}${path}`, origin);
    if (url.origin !== origin || !url.pathname.startsWith(`${apiPrefix}/reviewer/v1/`)) throw new Error('Недопустимый origin API.');
    let response;
    try {
      response = await fetcher(url.href, { method, body: body === undefined ? undefined : contentType ? body : JSON.stringify(body), headers: { authorization: `Bearer ${token}`, ...(body === undefined ? {} : { 'content-type': contentType ?? 'application/json' }) }, redirect: 'error', signal: AbortSignal.timeout(60_000) });
    } catch (error) { throw connectionError(error); }
    if (!response.ok) { await response.body?.cancel(); throw new Error(`API: HTTP ${response.status}. При 401 подключите новый ключ; при 409 перечитайте работу, не меняйте ревизии вручную.`); }
    if (raw) return response;
    const bytes = await readBounded(response, 2 * 1024 * 1024);
    try { return JSON.parse(bytes.toString('utf8')); } catch { throw new Error('API вернул некорректный JSON.'); }
  };
}
export async function readBounded(response, maxBytes) {
  const chunks = [];
  let size = 0;
  for await (const chunk of response.body) {
    size += chunk.byteLength;
    if (size > maxBytes) { throw new Error('Ответ превышает допустимый размер.'); }
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}
export async function privateDirectory(path) { await mkdir(path, { recursive: true, mode: 0o700 }); }
export async function privateWorkspace(directory) {
  await privateDirectory(directory);
  let current = await realpath(directory);
  while (true) {
    try { await lstat(join(current, '.git')); throw new Error('Фото и разборы должны храниться вне репозитория.'); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
    const parent = dirname(current);
    if (parent === current) return;
    current = parent;
  }
}
export async function writeJson(path, value) {
  await privateDirectory(dirname(path));
  const temporary = `${path}.${randomUUID()}.tmp`;
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600, flag: 'wx' });
  await rename(temporary, path);
}
export async function readJson(path) {
  const bytes = await readFile(path);
  if (bytes.length > 2 * 1024 * 1024) throw new Error('JSON слишком большой.');
  return JSON.parse(bytes.toString('utf8'));
}
export async function saveOperation(path, input) {
  await privateDirectory(dirname(path));
  const operation = { version: 1, requestId: randomUUID(), reportId: randomUUID(), input };
  try {
    const file = await open(path, 'wx', 0o600);
    try { await file.writeFile(`${JSON.stringify(operation, null, 2)}\n`); await file.sync(); } finally { await file.close(); }
    return operation;
  } catch (error) {
    if (error.code !== 'EEXIST') throw error;
    const previous = await readJson(path);
    uuid(previous.requestId); uuid(previous.reportId);
    if (previous.version !== 1 || JSON.stringify(previous.input) !== JSON.stringify(input)) throw new Error('Входные данные операции изменились; создайте новую операцию, не перезаписывайте старую.');
    return previous;
  }
}
function validateSource(value, id) {
  const source = ReviewerSolutionSchema.parse(value);
  if (source.id !== id || source.sourceRevision < 1 || source.photos.length > 10) throw new Error('Некорректный manifest решения.');
  const prefix = `/reviewer/v1/solutions/${id}`;
  const seen = new Set();
  for (const photo of source.photos) {
    if (seen.has(photo.id) || !/^[a-f\d]{64}$/i.test(photo.sha256) || !['image/jpeg', 'image/png', 'image/webp'].includes(photo.contentType) || photo.sizeBytes < 1 || photo.sizeBytes > 10 * 1024 * 1024 || photo.downloadPath !== `${prefix}/photos/${photo.id}?sourceRevision=${source.sourceRevision}`) throw new Error('Некорректное фото в manifest.');
    seen.add(photo.id);
  }
  seen.clear();
  for (const image of source.images) {
    if (!/^images\/[a-zA-Z0-9_./-]+\.(png|jpe?g|webp)$/i.test(image.name) || image.name.split('/').some((part) => !part || part === '.' || part === '..') || seen.has(image.name) || image.downloadPath !== `${prefix}/images/${encodeURIComponent(image.name.slice(7))}`) throw new Error('Некорректный рисунок в manifest.');
    seen.add(image.name);
  }
  return source;
}

export async function downloadSolution(api, id, directory, origin, apiPrefix = '/api') {
  uuid(id);
  await privateWorkspace(directory);
  const source = validateSource(await api(`/reviewer/v1/solutions/${id}`), id);
  await privateDirectory(directory);
  // No ready manifest survives an unsuccessful refresh of this directory.
  await unlink(join(directory, 'source.json')).catch((error) => { if (error.code !== 'ENOENT') throw error; });
  const manifest = { version: 1, origin, apiPrefix: normalizeApiPrefix(apiPrefix), source, photos: [], images: [] };
  for (const photo of source.photos) {
    const bytes = await readBounded(await api(photo.downloadPath, { raw: true }), 10 * 1024 * 1024);
    if (bytes.length !== photo.sizeBytes || sha256(bytes) !== photo.sha256) throw new Error('SHA-256 фото не совпадает. Получите решение заново.');
    const extension = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }[photo.contentType];
    const path = `photos/${photo.id}.${extension}`;
    await privateDirectory(join(directory, 'photos'));
    await writeFile(join(directory, path), bytes, { mode: 0o600 });
    manifest.photos.push({ id: photo.id, path, sha256: photo.sha256 });
  }
  for (const image of source.images) {
    const bytes = await readBounded(await api(image.downloadPath, { raw: true }), 10 * 1024 * 1024);
    await privateDirectory(dirname(join(directory, image.name)));
    await writeFile(join(directory, image.name), bytes, { mode: 0o600 });
    manifest.images.push({ name: image.name, path: image.name, sha256: sha256(bytes) });
  }
  await writeJson(join(directory, 'source.json'), manifest);
  await writeJson(join(directory, 'managed.json'), { owner: 'continuum-reviewer-pilot-v1', solutionId: source.id, sourceRevision: source.sourceRevision });
  return join(directory, 'source.json');
}
export async function loadManifest(path, origin, apiPrefix = '/api') {
  const manifest = await readJson(path);
  if (manifest.version !== 1 || manifest.origin !== origin || manifest.apiPrefix !== apiPrefix) throw new Error('Manifest другого сайта, API prefix или формата.');
  const source = validateSource(manifest.source, uuid(manifest.source?.id));
  if (manifest.photos?.length !== source.photos.length || manifest.images?.length !== source.images.length) throw new Error('Неполный manifest.');
  for (const file of [...manifest.photos, ...manifest.images]) {
    if (typeof file.path !== 'string' || !/^(photos|images)\/[a-zA-Z0-9_./-]+$/.test(file.path) || file.path.split('/').some((part) => !part || part === '..' || part === '.')) throw new Error('Небезопасный локальный путь.');
    if (sha256(await readFile(join(dirname(path), file.path))) !== file.sha256) throw new Error('Локальные файлы изменились после скачивания.');
  }
  return source;
}
