import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { AuthRequest } from '../auth/auth.request';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { LearningService } from './learning.service';

@Controller('teacher/notifications')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.teacher)
export class TeacherNotificationsController {
  constructor(private readonly learningService: LearningService) {}

  @Get()
  list(@Query('studentId') studentId: string | undefined, @Req() req: AuthRequest) {
    return this.learningService.listNotifications(req.user.id, studentId);
  }
}
