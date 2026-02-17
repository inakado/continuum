import { Controller, Get, Param, Query, Req, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { AuthRequest } from '../auth/auth.request';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { PhotoTaskService } from './photo-task.service';

@Controller('teacher/photo-submissions')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.teacher)
export class TeacherPhotoReviewInboxController {
  constructor(private readonly photoTaskService: PhotoTaskService) {}

  @Get()
  list(
    @Req() req: AuthRequest,
    @Query('status') status: string | undefined,
    @Query('studentId') studentId: string | undefined,
    @Query('courseId') courseId: string | undefined,
    @Query('sectionId') sectionId: string | undefined,
    @Query('unitId') unitId: string | undefined,
    @Query('taskId') taskId: string | undefined,
    @Query('limit') limit: string | undefined,
    @Query('offset') offset: string | undefined,
    @Query('sort') sort: string | undefined,
  ) {
    return this.photoTaskService.listInboxForTeacher(
      req.user.id,
      status,
      studentId,
      courseId,
      sectionId,
      unitId,
      taskId,
      limit,
      offset,
      sort,
    );
  }

  @Get(':submissionId')
  detail(
    @Req() req: AuthRequest,
    @Param('submissionId') submissionId: string,
    @Query('status') status: string | undefined,
    @Query('studentId') studentId: string | undefined,
    @Query('courseId') courseId: string | undefined,
    @Query('sectionId') sectionId: string | undefined,
    @Query('unitId') unitId: string | undefined,
    @Query('taskId') taskId: string | undefined,
    @Query('sort') sort: string | undefined,
  ) {
    return this.photoTaskService.getInboxSubmissionForTeacher(
      req.user.id,
      submissionId,
      status,
      studentId,
      courseId,
      sectionId,
      unitId,
      taskId,
      sort,
    );
  }
}
