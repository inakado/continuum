import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { Client } from 'pg';
import { expect, it } from 'vitest';

const migration = () => readFile(new URL('../../prisma/migrations/20261101010000_shared_teaching_bank/migration.sql', import.meta.url), 'utf8');
async function inSchema(check: (client: Client) => Promise<void>) {
  const client = new Client({ connectionString: process.env.DATABASE_URL, host: process.env.POSTGRES_HOST,
    port: Number(process.env.POSTGRES_PORT ?? 5432), database: process.env.POSTGRES_DB,
    user: process.env.POSTGRES_USER, password: process.env.POSTGRES_PASSWORD });
  const schema = `qa_shared_${randomUUID().replaceAll('-', '')}`;
  await client.connect();
  try {
    await client.query(`CREATE SCHEMA "${schema}"; SET search_path TO "${schema}"`);
    await client.query(`CREATE TABLE assessment_bank_tasks (id uuid PRIMARY KEY, teacher_id uuid NOT NULL, stable_id text NOT NULL, deleted_at timestamp, UNIQUE(teacher_id, stable_id))`);
    await check(client);
  } finally {
    await client.query('ROLLBACK');
    await client.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    await client.end();
  }
}
it('stops the actual migration on cross-author collisions including deleted tasks, without rewriting any row', async () => {
  await inSchema(async client => {
    await client.query('INSERT INTO assessment_bank_tasks VALUES ($1, $2, $3, NULL), ($4, $5, $3, now())', [randomUUID(), randomUUID(), 'same-source-id', randomUUID(), randomUUID()]);
    const before = (await client.query('SELECT * FROM assessment_bank_tasks ORDER BY id')).rows;
    await expect(client.query(await migration())).rejects.toThrow(/stableId collisions.*same-source-id/);
    await client.query('ROLLBACK');
    expect((await client.query('SELECT * FROM assessment_bank_tasks ORDER BY id')).rows).toEqual(before);
    expect((await client.query("SELECT indexname FROM pg_indexes WHERE schemaname = current_schema() AND indexname = 'assessment_bank_tasks_stable_id_key'")).rows).toEqual([]);
  });
});
it('migrates unique IDs unchanged and rejects duplicate IDs from a different author afterwards', async () => {
  await inSchema(async client => {
    await client.query('INSERT INTO assessment_bank_tasks VALUES ($1, $2, $3, NULL)', [randomUUID(), randomUUID(), 'shared-id']);
    const before = (await client.query('SELECT * FROM assessment_bank_tasks')).rows;
    await client.query(await migration());
    expect((await client.query('SELECT * FROM assessment_bank_tasks')).rows).toEqual(before);
    await expect(client.query('INSERT INTO assessment_bank_tasks VALUES ($1, $2, $3, NULL)', [randomUUID(), randomUUID(), 'shared-id'])).rejects.toMatchObject({ code: '23505' });
  });
});
