import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { Queue } from 'bullmq';
import { Roles } from './auth/decorators/roles.decorator';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { RolesGuard } from './auth/guards/roles.guard';

@Controller('debug')
export class DebugController {
  @Post('enqueue-ping')
  async enqueuePing(@Body() body: Record<string, unknown>) {
    const queue = new Queue('system.ping', {
      connection: {
        host: process.env.REDIS_HOST || 'redis',
        port: Number(process.env.REDIS_PORT || 6379),
        maxRetriesPerRequest: null,
      },
    });
    const job = await queue.add('ping', { at: new Date().toISOString(), ...body });
    await queue.close();
    return { queued: true, jobId: job.id };
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.teacher)
  @Get('teacher-only')
  teacherOnly() {
    return { ok: true, role: 'teacher' };
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.student)
  @Get('student-only')
  studentOnly() {
    return { ok: true, role: 'student' };
  }
}
