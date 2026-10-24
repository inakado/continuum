import { Controller, Get, Header, Inject, Param, ParseUUIDPipe, Query, Req, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { z } from 'zod';
import type { AuthRequest } from '../auth/auth.request';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { StatisticsReadService } from './statistics-read.service';

const query = z.strictObject({ recipient: z.uuid().optional() });
@Controller('teacher/assessment-statistics')
@UseGuards(RolesGuard)
@Roles(Role.teacher)
export class TeacherStatisticsController {
  constructor(@Inject(StatisticsReadService) private readonly reads: StatisticsReadService) {}
  @Get(':id')
  @Header('Cache-Control', 'no-store')
  report(@Req() request: AuthRequest, @Param('id', new ParseUUIDPipe()) id: string) { return this.reads.report(request.user.id, id); }
  @Get(':id/items/:taskId')
  @Header('Cache-Control', 'no-store')
  detail(@Req() request: AuthRequest, @Param('id', new ParseUUIDPipe()) id: string, @Param('taskId', new ParseUUIDPipe()) taskId: string,
    @Query(new ZodValidationPipe(query)) input: z.infer<typeof query>) { return this.reads.detail(request.user.id, id, taskId, input.recipient); }
}
