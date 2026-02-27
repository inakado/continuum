import { Controller, Get, Param, Query, Req, UseGuards } from '@nestjs/common';
import {
  TeacherPhotoInboxQuerySchema,
  TeacherPhotoSubmissionDetailQuerySchema,
  type TeacherPhotoInboxQuery,
  type TeacherPhotoSubmissionDetailQuery,
} from '@continuum/shared';
import { Role } from '@prisma/client';
import { AuthRequest } from '../auth/auth.request';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { teacherInboxQueryExceptionFactory } from '../common/validation/zod-exception-factories';
import { PhotoTaskService } from './photo-task.service';

@Controller('teacher/photo-submissions')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.teacher)
export class TeacherPhotoReviewInboxController {
  constructor(private readonly photoTaskService: PhotoTaskService) {}

  @Get()
  list(
    @Req() req: AuthRequest,
    @Query(new ZodValidationPipe(TeacherPhotoInboxQuerySchema, teacherInboxQueryExceptionFactory))
    query: TeacherPhotoInboxQuery,
  ) {
    return this.photoTaskService.listInboxForTeacher(req.user.id, query);
  }

  @Get(':submissionId')
  detail(
    @Req() req: AuthRequest,
    @Param('submissionId') submissionId: string,
    @Query(new ZodValidationPipe(TeacherPhotoSubmissionDetailQuerySchema, teacherInboxQueryExceptionFactory))
    query: TeacherPhotoSubmissionDetailQuery,
  ) {
    return this.photoTaskService.getInboxSubmissionForTeacher(req.user.id, submissionId, query);
  }
}
