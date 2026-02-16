import { Body, Controller, HttpCode, Param, Post, Req, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { AuthRequest } from '../auth/auth.request';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { OverrideOpenUnitDto } from './dto/override-open-unit.dto';
import { LearningService } from './learning.service';

@Controller('teacher/students')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.teacher)
export class TeacherUnitOverrideOpenController {
  constructor(private readonly learningService: LearningService) {}

  @Post(':studentId/units/:unitId/override-open')
  @HttpCode(200)
  overrideOpen(
    @Param('studentId') studentId: string,
    @Param('unitId') unitId: string,
    @Body() body: OverrideOpenUnitDto,
    @Req() req: AuthRequest,
  ) {
    return this.learningService.overrideOpenUnit(req.user.id, studentId, unitId, body?.reason);
  }
}
