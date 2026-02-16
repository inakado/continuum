import { Body, Controller, HttpCode, Param, Post, Req, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { AuthRequest } from '../auth/auth.request';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { TeacherTaskActionDto } from './dto/teacher-task-action.dto';
import { LearningService } from './learning.service';

@Controller('teacher/students')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.teacher)
export class TeacherTaskUnblockController {
  constructor(private readonly learningService: LearningService) {}

  @Post(':studentId/tasks/:taskId/unblock')
  @HttpCode(200)
  unblock(
    @Param('studentId') studentId: string,
    @Param('taskId') taskId: string,
    @Body() body: TeacherTaskActionDto,
    @Req() req: AuthRequest,
  ) {
    return this.learningService.unblockTask(req.user.id, studentId, taskId, body?.reason);
  }
}
