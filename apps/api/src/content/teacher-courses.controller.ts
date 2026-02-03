import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { EventCategory, Role } from '@prisma/client';
import { AuthRequest } from '../auth/auth.request';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { EventsLogService } from '../events/events-log.service';
import { ContentService } from './content.service';
import { CreateCourseDto, UpdateCourseDto } from './dto/course.dto';

@Controller('teacher/courses')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.teacher)
export class TeacherCoursesController {
  constructor(
    private readonly contentService: ContentService,
    private readonly eventsLogService: EventsLogService,
  ) {}

  @Get()
  list() {
    return this.contentService.listCourses();
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.contentService.getCourse(id);
  }

  @Post()
  async create(@Body() dto: CreateCourseDto, @Req() req: AuthRequest) {
    const course = await this.contentService.createCourse(dto);
    await this.eventsLogService.append({
      category: EventCategory.admin,
      eventType: 'CourseCreated',
      actorUserId: req.user.id,
      actorRole: req.user.role,
      entityType: 'course',
      entityId: course.id,
      payload: { title: course.title, status: course.status },
    });
    return course;
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateCourseDto, @Req() req: AuthRequest) {
    const course = await this.contentService.updateCourse(id, dto);
    await this.eventsLogService.append({
      category: EventCategory.admin,
      eventType: 'CourseUpdated',
      actorUserId: req.user.id,
      actorRole: req.user.role,
      entityType: 'course',
      entityId: course.id,
      payload: { title: course.title, status: course.status, changes: dto },
    });
    return course;
  }

  @Post(':id/publish')
  @HttpCode(200)
  async publish(@Param('id') id: string, @Req() req: AuthRequest) {
    const course = await this.contentService.publishCourse(id);
    await this.eventsLogService.append({
      category: EventCategory.admin,
      eventType: 'CoursePublished',
      actorUserId: req.user.id,
      actorRole: req.user.role,
      entityType: 'course',
      entityId: course.id,
      payload: { title: course.title, status: course.status },
    });
    return course;
  }

  @Post(':id/unpublish')
  @HttpCode(200)
  async unpublish(@Param('id') id: string, @Req() req: AuthRequest) {
    const course = await this.contentService.unpublishCourse(id);
    await this.eventsLogService.append({
      category: EventCategory.admin,
      eventType: 'CourseUnpublished',
      actorUserId: req.user.id,
      actorRole: req.user.role,
      entityType: 'course',
      entityId: course.id,
      payload: { title: course.title, status: course.status },
    });
    return course;
  }

  @Delete(':id')
  async remove(@Param('id') id: string, @Req() req: AuthRequest) {
    const course = await this.contentService.deleteCourse(id);
    await this.eventsLogService.append({
      category: EventCategory.admin,
      eventType: 'CourseDeleted',
      actorUserId: req.user.id,
      actorRole: req.user.role,
      entityType: 'course',
      entityId: course.id,
      payload: { title: course.title, status: course.status },
    });
    return course;
  }
}
