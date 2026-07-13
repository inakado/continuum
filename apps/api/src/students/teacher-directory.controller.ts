import { Controller, Get, Inject, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { StudentsService } from './students.service';

@Controller('teacher/teachers')
@UseGuards(RolesGuard)
@Roles(Role.teacher)
export class TeacherDirectoryController {
  constructor(
    @Inject(StudentsService)
    private readonly studentsService: StudentsService,
  ) {}

  @Get()
  list() {
    return this.studentsService.listTeachers();
  }
}
