import { Body, Controller, Get, HttpCode, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import {
  StudentPhotoPresignUploadRequestSchema,
  StudentPhotoPresignViewQuerySchema,
  StudentPhotoSubmitRequestSchema,
  type StudentPhotoPresignUploadRequest,
  type StudentPhotoPresignViewQuery,
  type StudentPhotoSubmitRequest,
} from '@continuum/shared';
import { Role } from '@prisma/client';
import { AuthRequest } from '../auth/auth.request';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import {
  photoPresignUploadExceptionFactory,
  photoPresignViewExceptionFactory,
  photoSubmitExceptionFactory,
} from '../common/validation/zod-exception-factories';
import { PhotoTaskService } from './photo-task.service';

@Controller('student/tasks')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.student)
export class StudentPhotoTasksController {
  constructor(private readonly photoTaskService: PhotoTaskService) {}

  @Post(':taskId/photo/presign-upload')
  @HttpCode(200)
  presignUpload(
    @Param('taskId') taskId: string,
    @Req() req: AuthRequest,
    @Body(new ZodValidationPipe(StudentPhotoPresignUploadRequestSchema, photoPresignUploadExceptionFactory))
    body: StudentPhotoPresignUploadRequest,
  ) {
    return this.photoTaskService.presignUpload(req.user.id, taskId, body);
  }

  @Post(':taskId/photo/submit')
  @HttpCode(200)
  submit(
    @Param('taskId') taskId: string,
    @Req() req: AuthRequest,
    @Body(new ZodValidationPipe(StudentPhotoSubmitRequestSchema, photoSubmitExceptionFactory))
    body: StudentPhotoSubmitRequest,
  ) {
    return this.photoTaskService.submit(req.user.id, taskId, body);
  }

  @Get(':taskId/photo/submissions')
  listSubmissions(@Param('taskId') taskId: string, @Req() req: AuthRequest) {
    return this.photoTaskService.listForStudent(req.user.id, taskId);
  }

  @Get(':taskId/photo/presign-view')
  presignView(
    @Param('taskId') taskId: string,
    @Req() req: AuthRequest,
    @Query(new ZodValidationPipe(StudentPhotoPresignViewQuerySchema, photoPresignViewExceptionFactory))
    query: StudentPhotoPresignViewQuery,
  ) {
    return this.photoTaskService.presignViewForStudent(req.user.id, taskId, query);
  }
}
