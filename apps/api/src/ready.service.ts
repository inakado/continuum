import { Injectable } from '@nestjs/common';
import { Client } from 'pg';

type ReadyCheck = {
  ok: boolean;
  details: Record<string, string>;
};

const withTimeout = async <T>(promise: Promise<T>, ms: number, label: string) => {
  let timeoutHandle: NodeJS.Timeout | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutHandle = setTimeout(() => reject(new Error(`${label} timeout`)), ms);
  });
  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeoutHandle) clearTimeout(timeoutHandle);
  }
};

@Injectable()
export class ReadyService {
  async check(): Promise<ReadyCheck> {
    const details: Record<string, string> = {};

    const pgClient = new Client({
      host: process.env.POSTGRES_HOST || 'postgres',
      port: Number(process.env.POSTGRES_PORT || 5432),
      user: process.env.POSTGRES_USER || 'continuum',
      password: process.env.POSTGRES_PASSWORD || 'continuum',
      database: process.env.POSTGRES_DB || 'continuum',
    });

    try {
      await withTimeout(pgClient.connect(), 2000, 'postgres');
      await withTimeout(pgClient.end(), 2000, 'postgres');
      details.postgres = 'ok';
    } catch (error) {
      try {
        await pgClient.end();
      } catch {}
      details.postgres = error instanceof Error ? error.message : 'error';
    }

    const ok = details.postgres === 'ok';
    return { ok, details };
  }
}
