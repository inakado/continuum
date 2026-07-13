import { Controller, Get, Inject, Param, Req, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { type AuthRequest } from '../auth/auth.request';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { LearningService } from './learning.service';

@Controller('teacher/students')
@UseGuards(RolesGuard)
@Roles(Role.teacher)
export class TeacherStudentUnitPreviewController {
  constructor(@Inject(LearningService) private readonly learningService: LearningService) {}

  @Get(':studentId/units/:unitId')
  get(
    @Param('studentId') studentId: string,
    @Param('unitId') unitId: string,
    @Req() req: AuthRequest,
  ) {
    return this.learningService.getTeacherUnitPreview(req.user.id, studentId, unitId);
  }
}
