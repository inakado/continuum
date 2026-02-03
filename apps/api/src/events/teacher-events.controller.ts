import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { EventCategory, Role } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { EventsLogService } from './events-log.service';

@Controller('teacher/events')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.teacher)
export class TeacherEventsController {
  constructor(private readonly eventsLogService: EventsLogService) {}

  @Get()
  list(
    @Query('category') category?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @Query('entityType') entityType?: string,
    @Query('entityId') entityId?: string,
  ) {
    const resolvedCategory =
      category === 'learning' || category === 'system' || category === 'admin'
        ? (category as EventCategory)
        : EventCategory.admin;

    const parsedLimit = limit ? Number(limit) : undefined;
    const parsedOffset = offset ? Number(offset) : undefined;

    return this.eventsLogService.list({
      category: resolvedCategory,
      limit: Number.isFinite(parsedLimit) ? parsedLimit : undefined,
      offset: Number.isFinite(parsedOffset) ? parsedOffset : undefined,
      entityType,
      entityId,
    });
  }
}
