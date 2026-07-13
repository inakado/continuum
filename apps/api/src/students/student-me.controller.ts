import { Controller, Get, Inject, Req, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import type { AuthRequest } from '../auth/auth.request';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { StudentsService } from './students.service';

@Controller('student/me')
@UseGuards(RolesGuard)
@Roles(Role.student)
export class StudentMeController {
  constructor(@Inject(StudentsService) private readonly studentsService: StudentsService) {}

  @Get()
  getMe(@Req() request: AuthRequest) {
    return this.studentsService.getStudentMe(request.user.id);
  }
}
