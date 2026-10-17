import { BadRequestException, Controller, Delete, Get, Header, Headers, Inject, Param, ParseUUIDPipe, Post, Query, Req, Res, StreamableFile, UseGuards } from '@nestjs/common';
import { AssessmentBankQuerySchema, type AssessmentBankQuery } from '@continuum/shared';
import { Role } from '@prisma/client';
import { z } from 'zod';
import type { Response } from 'express';
import type { AuthRequest } from '../auth/auth.request';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { assertWriteOrigin } from '../common/assert-write-origin';
import { AssessmentBankReadService } from './assessment-bank-read.service';
import { AssessmentBankWriteService } from './assessment-bank-write.service';

const VersionQuerySchema = z.object({ version: z.coerce.number().int().positive().max(100000).optional() });

@Controller('teacher/assessment-bank')
@UseGuards(RolesGuard)
@Roles(Role.teacher)
export class TeacherAssessmentBankController {
  constructor(@Inject(AssessmentBankReadService) private readonly reads: AssessmentBankReadService, @Inject(AssessmentBankWriteService) private readonly writes: AssessmentBankWriteService) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  list(@Req() request: AuthRequest, @Query(new ZodValidationPipe(AssessmentBankQuerySchema)) query: AssessmentBankQuery) { return this.reads.list(request.user.id, query); }

  @Get('tasks/:id')
  @Header('Cache-Control', 'no-store')
  view(@Req() request: AuthRequest, @Param('id', new ParseUUIDPipe()) id: string, @Query(new ZodValidationPipe(VersionQuerySchema)) query: z.infer<typeof VersionQuerySchema>) { return this.reads.view(request.user.id, id, query.version); }

  @Get('tasks/:id/images/:name')
  @Header('Cache-Control', 'no-store')
  async image(@Req() request: AuthRequest, @Param('id', new ParseUUIDPipe()) id: string, @Param('name') name: string, @Query(new ZodValidationPipe(VersionQuerySchema)) query: z.infer<typeof VersionQuerySchema>) {
    const image = await this.reads.image(request.user.id, id, name, undefined, query.version);
    return new StreamableFile(image.stream, { type: image.contentType });
  }

  @Post('imports/preview')
  @Header('Cache-Control', 'no-store')
  preview(@Req() request: AuthRequest, @Headers('content-type') type?: string, @Headers('content-length') length?: string) {
    assertWriteOrigin(request);
    if (!/^application\/(?:zip|octet-stream)(?:;|$)/i.test(type ?? '')) throw new BadRequestException('Загрузите ZIP с типом application/zip.');
    return this.writes.preview(request.user.id, request, length);
  }

  @Get('imports/:id/tasks/:stableId')
  @Header('Cache-Control', 'no-store')
  previewTask(@Req() request: AuthRequest, @Param('id', new ParseUUIDPipe()) id: string, @Param('stableId') stableId: string) { return this.reads.previewView(request.user.id, id, stableId); }

  @Get('imports/:id/tasks/:stableId/images/:name')
  @Header('Cache-Control', 'no-store')
  async previewImage(@Req() request: AuthRequest, @Param('id', new ParseUUIDPipe()) id: string, @Param('stableId') stableId: string, @Param('name') name: string) {
    const image = await this.reads.image(request.user.id, stableId, name, id);
    return new StreamableFile(image.stream, { type: image.contentType });
  }

  @Post('imports/:id/confirm')
  @Header('Cache-Control', 'no-store')
  confirm(@Req() request: AuthRequest, @Param('id', new ParseUUIDPipe()) id: string) { assertWriteOrigin(request); return this.writes.confirm(request.user.id, id); }

  @Delete('imports/:id')
  @Header('Cache-Control', 'no-store')
  discard(@Req() request: AuthRequest, @Param('id', new ParseUUIDPipe()) id: string) { assertWriteOrigin(request); return this.writes.discard(request.user.id, id); }

  @Get('export')
  @Header('Cache-Control', 'no-store')
  async export(@Req() request: AuthRequest, @Query(new ZodValidationPipe(AssessmentBankQuerySchema)) query: AssessmentBankQuery, @Res({ passthrough: true }) response: Response) {
    const bytes = await this.reads.export(request.user.id, query);
    response.setHeader('Content-Disposition', 'attachment; filename="continuum-assessments.zip"');
    return new StreamableFile(bytes, { type: 'application/zip' });
  }
}
