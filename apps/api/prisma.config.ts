import 'dotenv/config';
import { defineConfig } from 'prisma/config';

const resolveDatabaseUrl = () => {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const host = process.env.POSTGRES_HOST;
  const port = process.env.POSTGRES_PORT || '5432';
  const database = process.env.POSTGRES_DB;
  const user = process.env.POSTGRES_USER;
  const password = process.env.POSTGRES_PASSWORD || '';

  if (!host || !database || !user) {
    return '';
  }

  const auth = password ? `:${encodeURIComponent(password)}` : '';
  return `postgresql://${encodeURIComponent(user)}${auth}@${host}:${port}/${database}`;
};

const databaseUrl = resolveDatabaseUrl();
if (!databaseUrl) {
  throw new Error('DATABASE_URL or POSTGRES_* env vars must be set for Prisma.');
}

export default defineConfig({
  schema: './prisma/schema.prisma',
  datasource: { url: databaseUrl },
});
