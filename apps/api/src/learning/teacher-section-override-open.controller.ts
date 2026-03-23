import { Body, Controller, HttpCode, Inject, Param, Post, Req, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { type AuthRequest } from '../auth/auth.request';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { type OverrideOpenUnitDto } from './dto/override-open-unit.dto';
import { LearningService } from './learning.service';

@Controller('teacher/students')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.teacher)
export class TeacherSectionOverrideOpenController {
  constructor(@Inject(LearningService) private readonly learningService: LearningService) {}

  @Post(':studentId/sections/:sectionId/override-open')
  @HttpCode(200)
  overrideOpen(
    @Param('studentId') studentId: string,
    @Param('sectionId') sectionId: string,
    @Body() body: OverrideOpenUnitDto,
    @Req() req: AuthRequest,
  ) {
    return this.learningService.overrideOpenSection(req.user.id, studentId, sectionId, body?.reason);
  }
}
