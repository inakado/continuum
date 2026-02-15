import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Job, Queue } from 'bullmq';
import IORedis from 'ioredis';
import {
  LATEX_COMPILE_JOB_NAME,
  LATEX_COMPILE_QUEUE_NAME,
  LatexCompileQueuePayload,
  TaskSolutionLatexCompileQueuePayload,
  UnitLatexCompileQueuePayload,
} from './unit-pdf.constants';

@Injectable()
export class LatexCompileQueueService implements OnModuleDestroy {
  private readonly connection = new IORedis({
    host: process.env.REDIS_HOST || 'redis',
    port: Number(process.env.REDIS_PORT || 6379),
    maxRetriesPerRequest: null,
  });

  private readonly queue = new Queue(LATEX_COMPILE_QUEUE_NAME, {
    connection: this.connection,
    defaultJobOptions: {
      removeOnComplete: { count: 200 },
      removeOnFail: { count: 200 },
      attempts: 1,
    },
  });

  async enqueueUnitPdfCompile(payload: UnitLatexCompileQueuePayload): Promise<string> {
    const job = await this.queue.add(LATEX_COMPILE_JOB_NAME, payload);
    return String(job.id);
  }

  async enqueueTaskSolutionPdfCompile(payload: TaskSolutionLatexCompileQueuePayload): Promise<string> {
    const job = await this.queue.add(LATEX_COMPILE_JOB_NAME, payload);
    return String(job.id);
  }

  getJob(jobId: string): Promise<Job | undefined> {
    return this.queue.getJob(jobId);
  }

  async onModuleDestroy(): Promise<void> {
    await this.queue.close();
    await this.connection.quit();
  }
}
