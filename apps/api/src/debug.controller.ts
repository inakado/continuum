import { Body, Controller, Post } from '@nestjs/common';
import { Queue } from 'bullmq';
import IORedis from 'ioredis';

@Controller('debug')
export class DebugController {
  @Post('enqueue-ping')
  async enqueuePing(@Body() body: Record<string, unknown>) {
    const connection = new IORedis({
      host: process.env.REDIS_HOST || 'redis',
      port: Number(process.env.REDIS_PORT || 6379),
      maxRetriesPerRequest: null,
    });
    const queue = new Queue('system.ping', { connection });
    const job = await queue.add('ping', { at: new Date().toISOString(), ...body });
    await queue.close();
    await connection.quit();
    return { queued: true, jobId: job.id };
  }
}
