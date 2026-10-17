import { Body, Controller, Get, Header, Inject, Param, ParseIntPipe, ParseUUIDPipe, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { AssessmentWorkCreateSchema, AssessmentWorkUpdateSchema, AssessmentWorkFreezeSchema, type AssessmentWorkCreate, type AssessmentWorkUpdate } from '@continuum/shared';
import { Role } from '@prisma/client';
import type { AuthRequest } from '../auth/auth.request';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { assertWriteOrigin } from '../common/assert-write-origin';
import { AssessmentWorksReadService } from './assessment-works-read.service';
import { AssessmentWorksWriteService } from './assessment-works-write.service';

@Controller('teacher/assessment-works')
@UseGuards(RolesGuard)
@Roles(Role.teacher)
export class TeacherAssessmentWorksController {
  constructor(@Inject(AssessmentWorksReadService) private readonly reads: AssessmentWorksReadService, @Inject(AssessmentWorksWriteService) private readonly writes: AssessmentWorksWriteService) {}
  @Get()
  @Header('Cache-Control', 'no-store')
  list(@Req() request: AuthRequest) { return this.reads.list(request.user.id); }
  @Post()
  @Header('Cache-Control', 'no-store')
  create(@Req() request: AuthRequest, @Body(new ZodValidationPipe(AssessmentWorkCreateSchema)) input: AssessmentWorkCreate) { assertWriteOrigin(request); return this.writes.create(request.user.id, input); }
  @Get(':id')
  @Header('Cache-Control', 'no-store')
  detail(@Req() request: AuthRequest, @Param('id', new ParseUUIDPipe()) id: string) { return this.reads.detail(request.user.id, id); }
  @Patch(':id')
  @Header('Cache-Control', 'no-store')
  update(@Req() request: AuthRequest, @Param('id', new ParseUUIDPipe()) id: string, @Body(new ZodValidationPipe(AssessmentWorkUpdateSchema)) input: AssessmentWorkUpdate) { assertWriteOrigin(request); return this.writes.update(request.user.id, id, input); }
  @Post(':id/versions')
  @Header('Cache-Control', 'no-store')
  freeze(@Req() request: AuthRequest, @Param('id', new ParseUUIDPipe()) id: string, @Body(new ZodValidationPipe(AssessmentWorkFreezeSchema)) input: { expectedRevision: number }) { assertWriteOrigin(request); return this.writes.freeze(request.user.id, id, input.expectedRevision); }
  @Get(':id/versions/:number')
  @Header('Cache-Control', 'no-store')
  version(@Req() request: AuthRequest, @Param('id', new ParseUUIDPipe()) id: string, @Param('number', ParseIntPipe) number: number) { return this.reads.version(request.user.id, id, number); }
}
