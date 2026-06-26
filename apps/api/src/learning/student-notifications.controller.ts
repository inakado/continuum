import { Controller, Get, HttpCode, Inject, Param, Post, Req, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { type AuthRequest } from '../auth/auth.request';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { LearningService } from './learning.service';

@Controller('student/notifications')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.student)
export class StudentNotificationsController {
  constructor(@Inject(LearningService) private readonly learningService: LearningService) {}

  @Get()
  list(@Req() req: AuthRequest) {
    return this.learningService.listStudentNotifications(req.user.id);
  }

  @Post(':notificationId/read')
  @HttpCode(200)
  markRead(@Param('notificationId') notificationId: string, @Req() req: AuthRequest) {
    return this.learningService.markStudentNotificationRead(req.user.id, notificationId);
  }
}
