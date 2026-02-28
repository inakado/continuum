import { Body, Controller, Get, HttpCode, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import {
  TeacherPhotoPresignViewQuerySchema,
  TeacherPhotoQueueQuerySchema,
  TeacherPhotoRejectRequestSchema,
  type TeacherPhotoPresignViewQuery,
  type TeacherPhotoQueueQuery,
  type TeacherPhotoRejectRequest,
} from '@continuum/shared';
import { Role } from '@prisma/client';
import { type AuthRequest } from '../auth/auth.request';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import {
  photoPresignViewExceptionFactory,
  teacherQueueQueryExceptionFactory,
} from '../common/validation/zod-exception-factories';
import { PhotoTaskService } from './photo-task.service';

@Controller('teacher/students')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.teacher)
export class TeacherPhotoSubmissionsController {
  constructor(private readonly photoTaskService: PhotoTaskService) {}

  @Get(':studentId/photo-submissions')
  listQueue(
    @Param('studentId') studentId: string,
    @Req() req: AuthRequest,
    @Query(new ZodValidationPipe(TeacherPhotoQueueQuerySchema, teacherQueueQueryExceptionFactory))
    query: TeacherPhotoQueueQuery,
  ) {
    return this.photoTaskService.listQueueForTeacher(req.user.id, studentId, query);
  }

  @Get(':studentId/tasks/:taskId/photo-submissions')
  list(
    @Param('studentId') studentId: string,
    @Param('taskId') taskId: string,
    @Req() req: AuthRequest,
  ) {
    return this.photoTaskService.listForTeacher(req.user.id, studentId, taskId);
  }

  @Get(':studentId/tasks/:taskId/photo-submissions/presign-view')
  presignView(
    @Param('studentId') studentId: string,
    @Param('taskId') taskId: string,
    @Req() req: AuthRequest,
    @Query(new ZodValidationPipe(TeacherPhotoPresignViewQuerySchema, photoPresignViewExceptionFactory))
    query: TeacherPhotoPresignViewQuery,
  ) {
    return this.photoTaskService.presignViewForTeacher(req.user.id, studentId, taskId, query);
  }

  @Post(':studentId/tasks/:taskId/photo-submissions/:submissionId/accept')
  @HttpCode(200)
  accept(
    @Param('studentId') studentId: string,
    @Param('taskId') taskId: string,
    @Param('submissionId') submissionId: string,
    @Req() req: AuthRequest,
  ) {
    return this.photoTaskService.accept(req.user.id, studentId, taskId, submissionId);
  }

  @Post(':studentId/tasks/:taskId/photo-submissions/:submissionId/reject')
  @HttpCode(200)
  reject(
    @Param('studentId') studentId: string,
    @Param('taskId') taskId: string,
    @Param('submissionId') submissionId: string,
    @Req() req: AuthRequest,
    @Body(new ZodValidationPipe(TeacherPhotoRejectRequestSchema)) body: TeacherPhotoRejectRequest,
  ) {
    return this.photoTaskService.reject(req.user.id, studentId, taskId, submissionId, body);
  }
}
