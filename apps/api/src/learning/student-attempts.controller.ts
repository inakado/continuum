import { Body, Controller, Param, Post, Req, UseGuards } from '@nestjs/common';
import { StudentAttemptRequestSchema, type StudentAttemptRequest } from '@continuum/shared';
import { Role } from '@prisma/client';
import { type AuthRequest } from '../auth/auth.request';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { LearningService } from './learning.service';

@Controller('student')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.student)
export class StudentAttemptsController {
  constructor(private readonly learningService: LearningService) {}

  @Post('tasks/:taskId/attempts')
  submit(
    @Param('taskId') taskId: string,
    @Body(new ZodValidationPipe(StudentAttemptRequestSchema)) body: StudentAttemptRequest,
    @Req() req: AuthRequest,
  ) {
    return this.learningService.submitAttempt(req.user.id, taskId, body);
  }
}
