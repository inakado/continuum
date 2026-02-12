import { Controller, Get, Param, Req, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { AuthRequest } from '../auth/auth.request';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { LearningService } from './learning.service';

@Controller('teacher/students')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.teacher)
export class TeacherStudentUnitPreviewController {
  constructor(private readonly learningService: LearningService) {}

  @Get(':studentId/units/:unitId')
  get(
    @Param('studentId') studentId: string,
    @Param('unitId') unitId: string,
    @Req() req: AuthRequest,
  ) {
    return this.learningService.getTeacherUnitPreview(req.user.id, studentId, unitId);
  }
}

