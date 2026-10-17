import { Body, Controller, Get, Header, Inject, Param, ParseUUIDPipe, Post, Query, Req, UseGuards } from '@nestjs/common';
import { AssignmentCreateSchema, type AssignmentCreate } from '@continuum/shared';
import { Role } from '@prisma/client';
import { z } from 'zod';
import type { AuthRequest } from '../auth/auth.request';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { assertWriteOrigin } from '../common/assert-write-origin';
import { AssignmentReadService } from './assignment-read.service';
import { AssignmentWriteService } from './assignment-write.service';

const QuerySchema = z.object({ version: z.coerce.number().int().positive().optional() });
@Controller('teacher/assessment-assignments')
@UseGuards(RolesGuard)
@Roles(Role.teacher)
export class TeacherAssignmentsController {
  constructor(@Inject(AssignmentReadService) private readonly reads: AssignmentReadService, @Inject(AssignmentWriteService) private readonly writes: AssignmentWriteService) {}
  @Get()
  @Header('Cache-Control', 'no-store')
  list(@Req() request: AuthRequest) { return this.reads.list(request.user.id); }
  @Get('works/:id/prepare')
  @Header('Cache-Control', 'no-store')
  prepare(@Req() request: AuthRequest, @Param('id', new ParseUUIDPipe()) id: string, @Query(new ZodValidationPipe(QuerySchema)) query: z.infer<typeof QuerySchema>) { return this.reads.prepare(request.user.id, id, query.version); }
  @Post('works/:id')
  @Header('Cache-Control', 'no-store')
  assign(@Req() request: AuthRequest, @Param('id', new ParseUUIDPipe()) id: string, @Body(new ZodValidationPipe(AssignmentCreateSchema)) input: AssignmentCreate) {
    assertWriteOrigin(request); return this.writes.assign(request.user.id, id, input);
  }
  @Get(':id')
  @Header('Cache-Control', 'no-store')
  report(@Req() request: AuthRequest, @Param('id', new ParseUUIDPipe()) id: string) { return this.reads.report(request.user.id, id); }
}
