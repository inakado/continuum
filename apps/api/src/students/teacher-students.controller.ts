import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { EventCategory, Role } from '@prisma/client';
import { AuthRequest } from '../auth/auth.request';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { EventsLogService } from '../events/events-log.service';
import {
  CreateStudentDto,
  TransferStudentDto,
  UpdateStudentProfileDto,
} from './dto/student.dto';
import { StudentsService } from './students.service';

@Controller('teacher/students')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.teacher)
export class TeacherStudentsController {
  constructor(
    private readonly studentsService: StudentsService,
    private readonly eventsLogService: EventsLogService,
  ) {}

  @Get()
  list(@Req() req: AuthRequest, @Query('query') query?: string) {
    return this.studentsService.listStudents(req.user.id, query);
  }

  @Post()
  async create(@Body() dto: CreateStudentDto, @Req() req: AuthRequest) {
    const result = await this.studentsService.createStudent(
      dto.login,
      req.user.id,
      dto.firstName,
      dto.lastName,
    );

    await this.eventsLogService.append({
      category: EventCategory.admin,
      eventType: 'StudentCreated',
      actorUserId: req.user.id,
      actorRole: req.user.role,
      entityType: 'student',
      entityId: result.user.id,
      payload: {
        login: result.user.login,
        firstName: result.profile.firstName,
        lastName: result.profile.lastName,
      },
    });

    await this.eventsLogService.append({
      category: EventCategory.admin,
      eventType: 'LeadTeacherAssignedToStudent',
      actorUserId: req.user.id,
      actorRole: req.user.role,
      entityType: 'student',
      entityId: result.user.id,
      payload: { leadTeacherId: result.profile.leadTeacherId },
    });

    return {
      id: result.user.id,
      login: result.user.login,
      leadTeacherId: result.profile.leadTeacherId,
      firstName: result.profile.firstName,
      lastName: result.profile.lastName,
      password: result.password,
    };
  }

  @Post(':id/reset-password')
  @HttpCode(200)
  async reset(@Param('id') id: string, @Req() req: AuthRequest) {
    const result = await this.studentsService.resetPassword(id, req.user.id);

    await this.eventsLogService.append({
      category: EventCategory.admin,
      eventType: 'StudentPasswordReset',
      actorUserId: req.user.id,
      actorRole: req.user.role,
      entityType: 'student',
      entityId: result.id,
      payload: { login: result.login },
    });

    return result;
  }

  @Patch(':id/transfer')
  async transfer(
    @Param('id') id: string,
    @Body() dto: TransferStudentDto,
    @Req() req: AuthRequest,
  ) {
    const result = await this.studentsService.transferStudent(id, req.user.id, dto.leaderTeacherId);

    await this.eventsLogService.append({
      category: EventCategory.admin,
      eventType: 'LeadTeacherReassignedForStudent',
      actorUserId: req.user.id,
      actorRole: req.user.role,
      entityType: 'student',
      entityId: result.id,
      payload: {
        fromLeadTeacherId: result.previousLeadTeacherId,
        toLeadTeacherId: result.leadTeacherId,
      },
    });

    return {
      id: result.id,
      login: result.login,
      leadTeacherId: result.leadTeacherId,
      leadTeacherLogin: result.leadTeacherLogin,
    };
  }

  @Patch(':id')
  async updateProfile(
    @Param('id') id: string,
    @Body() dto: UpdateStudentProfileDto,
    @Req() req: AuthRequest,
  ) {
    const result = await this.studentsService.updateStudentProfile(
      id,
      req.user.id,
      dto.firstName,
      dto.lastName,
    );

    await this.eventsLogService.append({
      category: EventCategory.admin,
      eventType: 'StudentProfileUpdated',
      actorUserId: req.user.id,
      actorRole: req.user.role,
      entityType: 'student',
      entityId: result.id,
      payload: {
        firstName: result.firstName,
        lastName: result.lastName,
      },
    });

    return result;
  }

  @Delete(':id')
  async remove(@Param('id') id: string, @Req() req: AuthRequest) {
    const result = await this.studentsService.deleteStudent(id, req.user.id);

    await this.eventsLogService.append({
      category: EventCategory.admin,
      eventType: 'StudentDeleted',
      actorUserId: req.user.id,
      actorRole: req.user.role,
      entityType: 'student',
      entityId: result.id,
      payload: {
        studentUserId: result.id,
        leadTeacherId: result.leadTeacherId,
        login: result.login,
        firstName: result.firstName,
        lastName: result.lastName,
      },
    });

    return result;
  }
}
