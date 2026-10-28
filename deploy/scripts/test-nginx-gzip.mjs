import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import https from 'node:https';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { setTimeout as delay } from 'node:timers/promises';
import { gunzipSync } from 'node:zlib';

const config = resolve(dirname(fileURLToPath(import.meta.url)), '../nginx/continuum.conf');
const image = process.env.NGINX_TEST_IMAGE || 'nginx:alpine';
function run(...args) {
  const result = spawnSync(args[0], args.slice(1), { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr || result.error?.message);
  return result.stdout.trim();
}

test('production Nginx template compresses only allowed JSON reads without changing their body or routing', async (t) => {
  run('docker', 'image', 'inspect', image);
  const temporary = mkdtempSync(join(tmpdir(), 'continuum-gzip-'));
  let container;
  try {
    run('openssl', 'req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-days', '1', '-subj', '/CN=app.example.com', '-keyout', join(temporary, 'privkey.pem'), '-out', join(temporary, 'fullchain.pem'));
    const json = JSON.stringify({ tasks: Array.from({ length: 25 }, (_, n) => ({ n, title: 'Тестовая задача — только синтетические данные' })) });
    writeFileSync(join(temporary, 'upstream.conf'), `server {
      listen 3000;
      default_type application/json;
      add_header Cache-Control no-store always;
      add_header X-Upstream-URI $request_uri always;
      location / { return 200 '${json}'; }
      location ~ /images/ { default_type image/png; return 200 '${json}'; }
      location = /student/assessment-works/one/availability { return 200 '{"available":true}'; }
      location = /teacher/assessment-statistics/denied { return 403; }
    }`);
    const mounts = [
      '-v', `${config}:/etc/nginx/conf.d/default.conf:ro`,
      '-v', `${temporary}/upstream.conf:/etc/nginx/conf.d/upstream.conf:ro`,
      '-v', `${temporary}:/etc/letsencrypt/live/app.example.com:ro`];
    run('docker', 'run', '--rm', '--pull', 'never', ...mounts, image, 'nginx', '-t');
    container = run('docker', 'run', '--rm', '-d', '--pull', 'never', '-p', '127.0.0.1::443', ...mounts, image);
    const port = Number(run('docker', 'port', container, '443/tcp').split(':').at(-1));
    const request = (path, method = 'GET', encoding = 'gzip') => new Promise((resolveResponse, reject) => {
      const req = https.request({ hostname: '127.0.0.1', port, path, method, rejectUnauthorized: false,
        headers: { 'Accept-Encoding': encoding, Via: '1.1 local-test', Authorization: 'Bearer synthetic-test' } }, (res) => {
        const chunks = [];
        res.on('data', (chunk) => chunks.push(chunk));
        res.on('end', () => resolveResponse({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks) }));
      });
      req.setTimeout(5000, () => req.destroy(new Error('Local Nginx request timeout')));
      req.on('error', reject); req.end();
    });
    for (let attempt = 0; ; attempt++) {
      try { await request('/api/health'); break; }
      catch (error) { if (error.code !== 'ECONNREFUSED' || attempt === 19) throw error; await delay(50); }
    }
    for (const path of ['/api/teacher/assessment-bank?search=gas', '/api/teacher/assessment-works', '/api/teacher/assessment-assignments/one', '/api/teacher/assessment-statistics/one', '/api/student/assessment-works/one']) {
      await t.test(`gzip GET ${path}`, async () => {
        const compressed = await request(path);
        const identity = await request(path, 'GET', 'identity');
        assert.equal(compressed.status, 200);
        assert.equal(compressed.headers['content-encoding'], 'gzip');
        assert.equal(identity.headers['content-encoding'], undefined);
        assert.match(compressed.headers.vary, /Accept-Encoding/i);
        assert.equal(compressed.headers['cache-control'], 'no-store');
        assert.equal(identity.headers['cache-control'], 'no-store');
        assert.equal(compressed.headers['x-upstream-uri'], path.slice(4));
        assert.deepEqual(gunzipSync(compressed.body), identity.body);
        assert.equal(identity.body.toString(), json);
        assert.ok(compressed.body.length < identity.body.length / 2);
        console.log(`${path}: ${identity.body.length} -> ${compressed.body.length} bytes`);
      });
    }
    for (const [method, path] of [['POST', '/api/teacher/assessment-bank/imports/confirm'], ['PATCH', '/api/student/assessment-works/one/answers/two'], ['DELETE', '/api/teacher/assessment-works/one'], ['GET', '/api/auth/get-session'], ['POST', '/api/teacher/students/one/password-reset'], ['GET', '/api/teacher/reviewer-access/keys'], ['POST', '/api/teacher/reviewer-access/keys'], ['GET', '/api/teacher/assessment-statistics-other'], ['GET', '/api/teacher/assessment-bank/tasks/one/images/test.png'], ['HEAD', '/api/teacher/assessment-bank'], ['GET', '/api/student/assessment-works/one/availability']]) {
      await t.test(`no gzip ${method} ${path}`, async () => {
        const response = await request(path, method);
        assert.equal(response.status, 200);
        assert.equal(response.headers['content-encoding'], undefined);
      });
    }
    assert.equal((await request('/api/internal/test')).status, 404);
    assert.equal((await request('/api/teacher/assessment-statistics/denied')).status, 403);
  } finally {
    if (container) run('docker', 'rm', '-f', container);
    rmSync(temporary, { recursive: true, force: true });
  }
});
