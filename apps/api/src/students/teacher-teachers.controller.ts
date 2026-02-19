import { Body, Controller, Delete, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { EventCategory, Role } from '@prisma/client';
import { AuthRequest } from '../auth/auth.request';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { EventsLogService } from '../events/events-log.service';
import { CreateTeacherDto } from './dto/teacher-settings.dto';
import { StudentsService } from './students.service';

@Controller('teacher/teachers')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.teacher)
export class TeacherTeachersController {
  constructor(
    private readonly studentsService: StudentsService,
    private readonly eventsLogService: EventsLogService,
  ) {}

  @Get()
  list() {
    return this.studentsService.listTeachers();
  }

  @Post()
  async create(@Req() req: AuthRequest, @Body() dto: CreateTeacherDto) {
    const result = await this.studentsService.createTeacher(dto);

    await this.eventsLogService.append({
      category: EventCategory.admin,
      eventType: 'TeacherCreated',
      actorUserId: req.user.id,
      actorRole: req.user.role,
      entityType: 'teacher',
      entityId: result.user.id,
      payload: {
        login: result.user.login,
        firstName: result.profile.firstName,
        lastName: result.profile.lastName,
        middleName: result.profile.middleName,
      },
    });

    return {
      id: result.user.id,
      login: result.user.login,
      firstName: result.profile.firstName,
      lastName: result.profile.lastName,
      middleName: result.profile.middleName,
      password: result.password,
    };
  }

  @Delete(':id')
  async delete(@Param('id') id: string, @Req() req: AuthRequest) {
    const result = await this.studentsService.deleteTeacher(id, req.user.id);

    await this.eventsLogService.append({
      category: EventCategory.admin,
      eventType: 'TeacherDeleted',
      actorUserId: req.user.id,
      actorRole: req.user.role,
      entityType: 'teacher',
      entityId: result.id,
      payload: {
        login: result.login,
        firstName: result.firstName,
        lastName: result.lastName,
        middleName: result.middleName,
      },
    });

    return result;
  }
}
