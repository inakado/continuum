import { Body, Controller, Get, Header, HttpCode, Inject, Param, ParseUUIDPipe, Patch, Post, Req, StreamableFile, UseGuards } from '@nestjs/common';
import { AttemptFinishSchema, AttemptSaveSchema, type AttemptSave } from '@continuum/shared';
import { Role } from '@prisma/client';
import type { AuthRequest } from '../auth/auth.request';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { assertWriteOrigin } from '../common/assert-write-origin';
import { StudentAttemptReadService } from './student-attempt-read.service';
import { StudentAttemptWriteService } from './student-attempt-write.service';

@Controller('student/assessment-works')
@UseGuards(RolesGuard)
@Roles(Role.student)
export class StudentAttemptsController {
  constructor(@Inject(StudentAttemptReadService) private readonly reads: StudentAttemptReadService, @Inject(StudentAttemptWriteService) private readonly writes: StudentAttemptWriteService) {}
  @Get()
  @Header('Cache-Control', 'no-store')
  list(@Req() request: AuthRequest) { return this.reads.list(request.user.id); }
  @Get(':id/availability')
  @Header('Cache-Control', 'no-store')
  availability(@Req() request: AuthRequest, @Param('id', new ParseUUIDPipe()) id: string) { return this.reads.availability(request.user.id, id); }
  @Get(':id')
  @Header('Cache-Control', 'no-store')
  detail(@Req() request: AuthRequest, @Param('id', new ParseUUIDPipe()) id: string) { return this.reads.detail(request.user.id, id); }
  @Post(':id/start')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  start(@Req() request: AuthRequest, @Param('id', new ParseUUIDPipe()) id: string) { assertWriteOrigin(request); return this.writes.start(request.user.id, id); }
  @Patch(':id/answers/:taskId')
  @Header('Cache-Control', 'no-store')
  save(@Req() request: AuthRequest, @Param('id', new ParseUUIDPipe()) id: string, @Param('taskId', new ParseUUIDPipe()) taskId: string, @Body(new ZodValidationPipe(AttemptSaveSchema)) input: AttemptSave) { assertWriteOrigin(request); return this.writes.save(request.user.id, id, taskId, input); }
  @Post(':id/finish')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  finish(@Req() request: AuthRequest, @Param('id', new ParseUUIDPipe()) id: string, @Body(new ZodValidationPipe(AttemptFinishSchema)) input: { expectedRevision: number }) { assertWriteOrigin(request); return this.writes.finish(request.user.id, id, input.expectedRevision); }
  @Get(':id/items/:taskId/images/:name')
  @Header('Cache-Control', 'no-store')
  async image(@Req() request: AuthRequest, @Param('id', new ParseUUIDPipe()) id: string, @Param('taskId', new ParseUUIDPipe()) taskId: string, @Param('name') name: string) {
    const image = await this.reads.image(request.user.id, id, taskId, name);
    return new StreamableFile(image.stream, { type: image.contentType });
  }
}
