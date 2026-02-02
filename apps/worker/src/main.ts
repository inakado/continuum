import { Worker } from 'bullmq';
import IORedis from 'ioredis';
import { sharedVersion } from '@continuum/shared';

const redisHost = process.env.REDIS_HOST || 'redis';
const redisPort = Number(process.env.REDIS_PORT || 6379);

const connection = new IORedis({
  host: redisHost,
  port: redisPort,
  maxRetriesPerRequest: null,
});

const worker = new Worker(
  'system.ping',
  async (job) => {
    const now = new Date().toISOString();
    console.log(
      `[worker] handled job id=${job.id} at ${now} shared=${sharedVersion} data=${JSON.stringify(
        job.data,
      )}`,
    );
  },
  { connection },
);

worker.on('ready', () => {
  console.log('[worker] ready');
});

worker.on('failed', (job, error) => {
  console.error(`[worker] job failed id=${job?.id} error=${error?.message}`);
});
