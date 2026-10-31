import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { afterAll, expect, it } from 'vitest';
import { PrismaService } from '../../src/prisma/prisma.service';

const db = new PrismaService();
afterAll(() => db.$disconnect());

it('removes both deadlines only from live keys, preserving revoked, disabled and expired records', async () => {
  const migration = await readFile(resolve(process.cwd(), 'prisma/migrations/20261031020000_reviewer_keys_without_expiry/migration.sql'), 'utf8');
  await db.$transaction(async (tx) => {
    // Temporary tables shadow production names only on this transaction's connection.
    await tx.$executeRawUnsafe('CREATE TEMP TABLE reviewer_device_keys (id uuid PRIMARY KEY, "expiresAt" timestamp NOT NULL, "revokedAt" timestamp) ON COMMIT DROP');
    await tx.$executeRawUnsafe('CREATE TEMP TABLE api_keys (id uuid PRIMARY KEY, "expiresAt" timestamp, enabled boolean, "updatedAt" timestamp) ON COMMIT DROP');
    const future = new Date(Date.now() + 86400000), past = new Date(Date.now() - 86400000);
    const cases = [
      { id: randomUUID(), deviceExpiry: future, apiExpiry: future, revoked: null, enabled: true, convert: true },
      { id: randomUUID(), deviceExpiry: future, apiExpiry: null, revoked: null, enabled: true, convert: true },
      { id: randomUUID(), deviceExpiry: future, apiExpiry: future, revoked: past, enabled: true, convert: false },
      { id: randomUUID(), deviceExpiry: past, apiExpiry: future, revoked: null, enabled: true, convert: false },
      { id: randomUUID(), deviceExpiry: future, apiExpiry: past, revoked: null, enabled: true, convert: false },
      { id: randomUUID(), deviceExpiry: future, apiExpiry: future, revoked: null, enabled: false, convert: false },
    ];
    for (const item of cases) {
      await tx.$executeRaw`INSERT INTO reviewer_device_keys VALUES (${item.id}::uuid, ${item.deviceExpiry}, ${item.revoked})`;
      await tx.$executeRaw`INSERT INTO api_keys VALUES (${item.id}::uuid, ${item.apiExpiry}, ${item.enabled}, CURRENT_TIMESTAMP)`;
    }
    // Replay also verifies the backfill is idempotent.
    for (let run = 0; run < 2; run++) {
      for (const statement of migration.split(';').map(part => part.trim()).filter(Boolean)) await tx.$executeRawUnsafe(statement);
      for (const item of cases) {
        const [row] = await tx.$queryRaw<{ deviceExpiry: Date | null; apiExpiry: Date | null; revoked: Date | null; enabled: boolean }[]>`
          SELECT device."expiresAt" AS "deviceExpiry", api."expiresAt" AS "apiExpiry", device."revokedAt" AS revoked, api.enabled
          FROM reviewer_device_keys device JOIN api_keys api USING (id) WHERE id = ${item.id}::uuid`;
        expect(row).toEqual({ deviceExpiry: item.convert ? null : item.deviceExpiry, apiExpiry: item.convert ? null : item.apiExpiry, revoked: item.revoked, enabled: item.enabled });
      }
    }
  });
});
