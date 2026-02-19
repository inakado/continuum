import { Body, Controller, Get, HttpCode, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { EventCategory, Role } from '@prisma/client';
import { AuthRequest } from '../auth/auth.request';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { EventsLogService } from '../events/events-log.service';
import {
  ChangeTeacherPasswordDto,
  UpdateTeacherProfileDto,
} from './dto/teacher-settings.dto';
import { StudentsService } from './students.service';

@Controller('teacher/me')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.teacher)
export class TeacherMeController {
  constructor(
    private readonly studentsService: StudentsService,
    private readonly eventsLogService: EventsLogService,
  ) {}

  @Get()
  getMe(@Req() req: AuthRequest) {
    return this.studentsService.getTeacherMe(req.user.id);
  }

  @Patch()
  async updateProfile(@Req() req: AuthRequest, @Body() dto: UpdateTeacherProfileDto) {
    const profile = await this.studentsService.updateTeacherProfile(
      req.user.id,
      dto.firstName,
      dto.lastName,
      dto.middleName,
    );

    await this.eventsLogService.append({
      category: EventCategory.admin,
      eventType: 'TeacherProfileUpdated',
      actorUserId: req.user.id,
      actorRole: req.user.role,
      entityType: 'teacher',
      entityId: req.user.id,
      payload: {
        login: req.user.login,
        firstName: profile.firstName,
        lastName: profile.lastName,
        middleName: profile.middleName,
      },
    });

    return {
      user: req.user,
      profile: {
        firstName: profile.firstName,
        lastName: profile.lastName,
        middleName: profile.middleName,
      },
    };
  }

  @Post('change-password')
  @HttpCode(200)
  async changePassword(@Req() req: AuthRequest, @Body() dto: ChangeTeacherPasswordDto) {
    await this.studentsService.changeTeacherPassword(
      req.user.id,
      dto.currentPassword,
      dto.newPassword,
    );

    await this.eventsLogService.append({
      category: EventCategory.admin,
      eventType: 'TeacherPasswordChanged',
      actorUserId: req.user.id,
      actorRole: req.user.role,
      entityType: 'teacher',
      entityId: req.user.id,
      payload: {
        login: req.user.login,
      },
    });

    return { ok: true };
  }
}
