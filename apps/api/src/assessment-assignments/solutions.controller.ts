import { Controller, Delete, Get, Header, Headers, Inject, Param, ParseUUIDPipe, Put, Query, Req, StreamableFile, UseGuards } from '@nestjs/common';
import { SolutionPhotoMutationSchema, type SolutionPhotoMutation } from '@continuum/shared';
import { Role } from '@prisma/client';
import type { AuthRequest } from '../auth/auth.request';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { assertWriteOrigin } from '../common/assert-write-origin';
import { SolutionReadService } from './solution-read.service';
import { SolutionWriteService } from './solution-write.service';

@Controller('assessment-solutions/:id')
@UseGuards(RolesGuard)
@Roles(Role.student, Role.teacher)
export class SolutionsController {
  constructor(@Inject(SolutionReadService) private readonly reads: SolutionReadService, @Inject(SolutionWriteService) private readonly writes: SolutionWriteService) {}
  @Get()
  @Header('Cache-Control', 'no-store')
  list(@Req() request: AuthRequest, @Param('id', new ParseUUIDPipe()) id: string) { return this.reads.list(request.user, id); }
  @Get('items/:taskId/review')
  @Header('Cache-Control', 'no-store')
  async review(@Req() request: AuthRequest, @Param('id', new ParseUUIDPipe()) id: string, @Param('taskId', new ParseUUIDPipe()) taskId: string) {
    return new StreamableFile(await this.reads.publishedReport(request.user, id, taskId), { type: 'application/pdf', disposition: 'attachment; filename="razbor.pdf"' });
  }
  @Get('items/:taskId/photos/:photoId')
  @Header('Cache-Control', 'no-store')
  async photo(@Req() request: AuthRequest, @Param('id', new ParseUUIDPipe()) id: string, @Param('taskId', new ParseUUIDPipe()) taskId: string, @Param('photoId', new ParseUUIDPipe()) photoId: string) {
    const photo = await this.reads.photo(request.user, id, taskId, photoId);
    return new StreamableFile(photo.stream, { type: photo.contentType });
  }
  @Put('items/:taskId/photos/:photoId')
  @Roles(Role.student)
  @Header('Cache-Control', 'no-store')
  upload(@Req() request: AuthRequest, @Param('id', new ParseUUIDPipe()) id: string, @Param('taskId', new ParseUUIDPipe()) taskId: string, @Param('photoId', new ParseUUIDPipe()) photoId: string,
    @Query(new ZodValidationPipe(SolutionPhotoMutationSchema)) input: SolutionPhotoMutation, @Headers('content-type') type = '', @Headers('content-length') length?: string) {
    assertWriteOrigin(request);
    return this.writes.upload(request.user.id, id, taskId, photoId, input, request, type, length);
  }
  @Delete('items/:taskId/photos/:photoId')
  @Roles(Role.student)
  @Header('Cache-Control', 'no-store')
  remove(@Req() request: AuthRequest, @Param('id', new ParseUUIDPipe()) id: string, @Param('taskId', new ParseUUIDPipe()) taskId: string, @Param('photoId', new ParseUUIDPipe()) photoId: string,
    @Query(new ZodValidationPipe(SolutionPhotoMutationSchema)) input: SolutionPhotoMutation) {
    assertWriteOrigin(request); return this.writes.remove(request.user.id, id, taskId, photoId, input.revision);
  }
}
