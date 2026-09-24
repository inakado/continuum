import { Body, Controller, Get, Headers, Inject, Param, Patch, Post, Put, Query, Req, UseGuards } from '@nestjs/common';
import {
  CreateLessonInputSchema,
  CreateSectionInputSchema,
  ResourceIdParamsSchema,
  SetAccessGrantInputSchema,
  UpdateLessonInputSchema,
  UpdateSectionInputSchema,
  type CreateLessonInput,
  type CreateSectionInput,
  UploadLessonArtifactQuerySchema,
  type UploadLessonArtifactQuery,
  type ResourceIdParams,
  type SetAccessGrantInput,
  type UpdateLessonInput,
  type UpdateSectionInput,
} from '@continuum/shared';
import { Role } from '@prisma/client';
import type { AuthRequest } from '../auth/auth.request';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { LibraryReadService } from './library-read.service';
import { LibraryWriteService } from './library-write.service';

@Controller('teacher/library')
@UseGuards(RolesGuard)
@Roles(Role.teacher)
export class TeacherLibraryController {
  constructor(
    @Inject(LibraryReadService) private readonly reads: LibraryReadService,
    @Inject(LibraryWriteService) private readonly writes: LibraryWriteService,
  ) {}

  @Get()
  getLibrary(@Req() request: AuthRequest) {
    return this.reads.getTeacherLibrary(request.user.id);
  }

  @Get('lessons/:id')
  getLesson(
    @Req() request: AuthRequest,
    @Param(new ZodValidationPipe(ResourceIdParamsSchema)) params: ResourceIdParams,
  ) {
    return this.reads.getTeacherLesson(request.user.id, params.id);
  }

  @Post('sections')
  createSection(
    @Req() request: AuthRequest,
    @Body(new ZodValidationPipe(CreateSectionInputSchema)) input: CreateSectionInput,
  ) {
    return this.writes.createSection(request.user.id, input);
  }

  @Patch('sections/:id')
  updateSection(
    @Req() request: AuthRequest,
    @Param(new ZodValidationPipe(ResourceIdParamsSchema)) params: ResourceIdParams,
    @Body(new ZodValidationPipe(UpdateSectionInputSchema)) input: UpdateSectionInput,
  ) {
    return this.writes.updateSection(request.user.id, params.id, input);
  }

  @Patch('sections/:id/publish')
  publishSection(
    @Req() request: AuthRequest,
    @Param(new ZodValidationPipe(ResourceIdParamsSchema)) params: ResourceIdParams,
  ) {
    return this.writes.publishSection(request.user.id, params.id);
  }

  @Post('lessons')
  createLesson(
    @Req() request: AuthRequest,
    @Body(new ZodValidationPipe(CreateLessonInputSchema)) input: CreateLessonInput,
  ) {
    return this.writes.createLesson(request.user.id, input);
  }

  @Patch('lessons/:id')
  updateLesson(
    @Req() request: AuthRequest,
    @Param(new ZodValidationPipe(ResourceIdParamsSchema)) params: ResourceIdParams,
    @Body(new ZodValidationPipe(UpdateLessonInputSchema)) input: UpdateLessonInput,
  ) {
    return this.writes.updateLesson(request.user.id, params.id, input);
  }

  @Put('lessons/:id/artifacts/upload')
  uploadArtifact(
    @Req() request: AuthRequest,
    @Param(new ZodValidationPipe(ResourceIdParamsSchema)) params: ResourceIdParams,
    @Query(new ZodValidationPipe(UploadLessonArtifactQuerySchema)) input: UploadLessonArtifactQuery,
    @Headers('content-type') contentType: string | undefined,
    @Headers('content-length') contentLength: string | undefined,
  ) {
    return this.writes.uploadArtifact(request.user.id, params.id, {
      ...input,
      contentType: contentType ?? '',
    }, contentLength, request);
  }

  @Get('artifacts/:id/view')
  getArtifactView(
    @Req() request: AuthRequest,
    @Param(new ZodValidationPipe(ResourceIdParamsSchema)) params: ResourceIdParams,
  ) {
    return this.reads.getTeacherArtifactView(request.user.id, params.id);
  }

  @Patch('lessons/:id/publish')
  publishLesson(
    @Req() request: AuthRequest,
    @Param(new ZodValidationPipe(ResourceIdParamsSchema)) params: ResourceIdParams,
  ) {
    return this.writes.publishLesson(request.user.id, params.id);
  }

  @Put('access-grants')
  setAccessGrant(
    @Req() request: AuthRequest,
    @Body(new ZodValidationPipe(SetAccessGrantInputSchema)) input: SetAccessGrantInput,
  ) {
    return this.writes.setAccessGrant(request.user.id, input);
  }
}
