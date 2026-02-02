import { Injectable } from '@nestjs/common';
import { Client } from 'pg';
import { createClient } from 'redis';

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

    const redisUrl = `redis://${process.env.REDIS_HOST || 'redis'}:${process.env.REDIS_PORT || 6379}`;
    const redis = createClient({ url: redisUrl });

    try {
      await withTimeout(redis.connect(), 2000, 'redis');
      await withTimeout(redis.ping(), 2000, 'redis');
      await withTimeout(redis.quit(), 2000, 'redis');
      details.redis = 'ok';
    } catch (error) {
      try {
        await redis.quit();
      } catch {}
      details.redis = error instanceof Error ? error.message : 'error';
    }

    const ok = details.postgres === 'ok' && details.redis === 'ok';
    return { ok, details };
  }
}
