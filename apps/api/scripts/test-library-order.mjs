import { existsSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { Client } from 'pg';

// Full-catalog permutations need an isolated database, even when the dev catalog is populated.
const url = new URL(process.env.DATABASE_URL || `postgresql://${encodeURIComponent(process.env.POSTGRES_USER)}:${encodeURIComponent(process.env.POSTGRES_PASSWORD || '')}@${process.env.POSTGRES_HOST}:${process.env.POSTGRES_PORT || '5432'}/${process.env.POSTGRES_DB}`);
if (!existsSync('/.dockerenv') || url.hostname !== 'postgres' || process.env.APP_ENV === 'production' || process.env.NODE_ENV === 'production') {
  throw new Error('Run only in the local Docker Compose API container with PostgreSQL service postgres.');
}
const admin = new Client({ connectionString: url.href });
const name = `continuum_order_${randomUUID().replaceAll('-', '')}`;
await admin.connect();
try {
  await admin.query(`CREATE DATABASE "${name}"`);
  url.pathname = '/' + name;
  const env = { ...process.env, DATABASE_URL: url.href, POSTGRES_DB: name, LIBRARY_ORDER_TEST_DB: name,
    NODE_ENV: 'test', APP_ENV: 'test', WEB_ORIGIN: 'http://localhost:3001', CORS_ORIGIN: 'http://localhost:3001', BETTER_AUTH_URL: 'http://localhost:3000' };
  for (const args of [['exec', 'prisma', 'migrate', 'deploy'], ['test:integration', 'test/integration/library-order.integration.test.ts']]) {
    const result = spawnSync('pnpm', args, { env, stdio: 'inherit' });
    if (result.error) throw result.error;
    if (result.status !== 0) { process.exitCode = result.status || 1; break; }
  }
} finally {
  try { await admin.query(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`); }
  finally { await admin.end(); }
}
