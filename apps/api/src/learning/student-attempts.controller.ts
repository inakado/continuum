import { Body, Controller, Param, Post, Req, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { AuthRequest } from '../auth/auth.request';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { LearningService } from './learning.service';

@Controller('student')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.student)
export class StudentAttemptsController {
  constructor(private readonly learningService: LearningService) {}

  @Post('tasks/:taskId/attempts')
  submit(@Param('taskId') taskId: string, @Body() body: unknown, @Req() req: AuthRequest) {
    return this.learningService.submitAttempt(req.user.id, taskId, body);
  }
}
