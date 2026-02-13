import { Worker } from 'bullmq';
import IORedis from 'ioredis';
import { createLatexCompileProcessor } from './latex/latex-compile.worker';
import { LATEX_COMPILE_QUEUE_NAME } from './latex/latex-queue.contract';
import { resolveWorkerObjectStorageConfig } from './storage/object-storage-config';
import { WorkerObjectStorageService } from './storage/object-storage';

const redisHost = process.env.REDIS_HOST || 'redis';
const redisPort = Number(process.env.REDIS_PORT || 6379);

const connection = new IORedis({
  host: redisHost,
  port: redisPort,
  maxRetriesPerRequest: null,
});

const pingWorker = new Worker(
  'system.ping',
  async (job) => {
    const now = new Date().toISOString();
    console.log(`[worker] handled job id=${job.id} at ${now} data=${JSON.stringify(job.data)}`);
  },
  { connection },
);

const storage = new WorkerObjectStorageService(resolveWorkerObjectStorageConfig());
const latexConcurrencyRaw = Number(process.env.LATEX_COMPILE_WORKER_CONCURRENCY || 1);
const latexConcurrency = Number.isFinite(latexConcurrencyRaw) && latexConcurrencyRaw > 0
  ? Math.floor(latexConcurrencyRaw)
  : 1;

const latexWorker = new Worker(
  LATEX_COMPILE_QUEUE_NAME,
  createLatexCompileProcessor(storage),
  { connection, concurrency: latexConcurrency },
);

pingWorker.on('ready', () => {
  console.log('[worker] ping ready');
});

pingWorker.on('failed', (job, error) => {
  console.error(`[worker] ping failed id=${job?.id} error=${error?.message}`);
});

latexWorker.on('ready', () => {
  console.log(`[worker] latex ready concurrency=${latexConcurrency}`);
});

latexWorker.on('failed', (job, error) => {
  console.error(`[worker] latex failed id=${job?.id} error=${error?.message}`);
});
