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
import { CreateSectionDto, UpdateSectionDto } from './dto/section.dto';

@Controller('teacher/sections')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.teacher)
export class TeacherSectionsController {
  constructor(
    private readonly contentService: ContentService,
    private readonly eventsLogService: EventsLogService,
  ) {}

  @Get(':id')
  get(@Param('id') id: string) {
    return this.contentService.getSection(id);
  }

  @Post()
  async create(@Body() dto: CreateSectionDto, @Req() req: AuthRequest) {
    const section = await this.contentService.createSection(dto);
    await this.eventsLogService.append({
      category: EventCategory.admin,
      eventType: 'SectionCreated',
      actorUserId: req.user.id,
      actorRole: req.user.role,
      entityType: 'section',
      entityId: section.id,
      payload: {
        title: section.title,
        status: section.status,
        courseId: section.courseId,
        sortOrder: section.sortOrder,
      },
    });
    return section;
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateSectionDto,
    @Req() req: AuthRequest,
  ) {
    const section = await this.contentService.updateSection(id, dto);
    await this.eventsLogService.append({
      category: EventCategory.admin,
      eventType: 'SectionUpdated',
      actorUserId: req.user.id,
      actorRole: req.user.role,
      entityType: 'section',
      entityId: section.id,
      payload: {
        title: section.title,
        status: section.status,
        courseId: section.courseId,
        sortOrder: section.sortOrder,
        changes: dto,
      },
    });
    return section;
  }

  @Post(':id/publish')
  @HttpCode(200)
  async publish(@Param('id') id: string, @Req() req: AuthRequest) {
    const section = await this.contentService.publishSection(id);
    await this.eventsLogService.append({
      category: EventCategory.admin,
      eventType: 'SectionPublished',
      actorUserId: req.user.id,
      actorRole: req.user.role,
      entityType: 'section',
      entityId: section.id,
      payload: {
        title: section.title,
        status: section.status,
        courseId: section.courseId,
      },
    });
    return section;
  }

  @Post(':id/unpublish')
  @HttpCode(200)
  async unpublish(@Param('id') id: string, @Req() req: AuthRequest) {
    const section = await this.contentService.unpublishSection(id);
    await this.eventsLogService.append({
      category: EventCategory.admin,
      eventType: 'SectionUnpublished',
      actorUserId: req.user.id,
      actorRole: req.user.role,
      entityType: 'section',
      entityId: section.id,
      payload: {
        title: section.title,
        status: section.status,
        courseId: section.courseId,
      },
    });
    return section;
  }

  @Delete(':id')
  async remove(@Param('id') id: string, @Req() req: AuthRequest) {
    const section = await this.contentService.deleteSection(id);
    await this.eventsLogService.append({
      category: EventCategory.admin,
      eventType: 'SectionDeleted',
      actorUserId: req.user.id,
      actorRole: req.user.role,
      entityType: 'section',
      entityId: section.id,
      payload: {
        title: section.title,
        status: section.status,
        courseId: section.courseId,
      },
    });
    return section;
  }
}
