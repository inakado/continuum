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
import { CreateUnitDto, UpdateUnitDto } from './dto/unit.dto';

@Controller('teacher/units')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.teacher)
export class TeacherUnitsController {
  constructor(
    private readonly contentService: ContentService,
    private readonly eventsLogService: EventsLogService,
  ) {}

  @Get(':id')
  get(@Param('id') id: string) {
    return this.contentService.getUnit(id);
  }

  @Post()
  async create(@Body() dto: CreateUnitDto, @Req() req: AuthRequest) {
    const unit = await this.contentService.createUnit(dto);
    await this.eventsLogService.append({
      category: EventCategory.admin,
      eventType: 'UnitCreated',
      actorUserId: req.user.id,
      actorRole: req.user.role,
      entityType: 'unit',
      entityId: unit.id,
      payload: {
        title: unit.title,
        status: unit.status,
        sectionId: unit.sectionId,
        sortOrder: unit.sortOrder,
      },
    });
    return unit;
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateUnitDto, @Req() req: AuthRequest) {
    const unit = await this.contentService.updateUnit(id, dto);
    await this.eventsLogService.append({
      category: EventCategory.admin,
      eventType: 'UnitUpdated',
      actorUserId: req.user.id,
      actorRole: req.user.role,
      entityType: 'unit',
      entityId: unit.id,
      payload: {
        title: unit.title,
        status: unit.status,
        sectionId: unit.sectionId,
        sortOrder: unit.sortOrder,
        changes: dto,
      },
    });
    return unit;
  }

  @Post(':id/publish')
  @HttpCode(200)
  async publish(@Param('id') id: string, @Req() req: AuthRequest) {
    const unit = await this.contentService.publishUnit(id);
    await this.eventsLogService.append({
      category: EventCategory.admin,
      eventType: 'UnitPublished',
      actorUserId: req.user.id,
      actorRole: req.user.role,
      entityType: 'unit',
      entityId: unit.id,
      payload: { title: unit.title, status: unit.status, sectionId: unit.sectionId },
    });
    return unit;
  }

  @Post(':id/unpublish')
  @HttpCode(200)
  async unpublish(@Param('id') id: string, @Req() req: AuthRequest) {
    const unit = await this.contentService.unpublishUnit(id);
    await this.eventsLogService.append({
      category: EventCategory.admin,
      eventType: 'UnitUnpublished',
      actorUserId: req.user.id,
      actorRole: req.user.role,
      entityType: 'unit',
      entityId: unit.id,
      payload: { title: unit.title, status: unit.status, sectionId: unit.sectionId },
    });
    return unit;
  }

  @Delete(':id')
  async remove(@Param('id') id: string, @Req() req: AuthRequest) {
    const unit = await this.contentService.deleteUnit(id);
    await this.eventsLogService.append({
      category: EventCategory.admin,
      eventType: 'UnitDeleted',
      actorUserId: req.user.id,
      actorRole: req.user.role,
      entityType: 'unit',
      entityId: unit.id,
      payload: { title: unit.title, status: unit.status, sectionId: unit.sectionId },
    });
    return unit;
  }
}
