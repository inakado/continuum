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
import { CreateTaskDto, UpdateTaskDto } from './dto/task.dto';

@Controller('teacher/tasks')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.teacher)
export class TeacherTasksController {
  constructor(
    private readonly contentService: ContentService,
    private readonly eventsLogService: EventsLogService,
  ) {}

  @Get(':id')
  get(@Param('id') id: string) {
    return this.contentService.getTask(id);
  }

  @Post()
  async create(@Body() dto: CreateTaskDto, @Req() req: AuthRequest) {
    const task = await this.contentService.createTask(dto);
    await this.eventsLogService.append({
      category: EventCategory.admin,
      eventType: 'TaskCreated',
      actorUserId: req.user.id,
      actorRole: req.user.role,
      entityType: 'task',
      entityId: task.id,
      payload: {
        title: task.title,
        status: task.status,
        unitId: task.unitId,
        answerType: task.answerType,
        isRequired: task.isRequired,
      },
    });
    return task;
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateTaskDto, @Req() req: AuthRequest) {
    const task = await this.contentService.updateTask(id, dto);
    const changedFields = Object.entries(dto)
      .filter(([, value]) => value !== undefined)
      .map(([key]) => key);

    const sizes: Record<string, number> = {};
    if ('statementLite' in dto && dto.statementLite !== undefined) {
      sizes.statementLite = (dto.statementLite ?? '').length;
    }
    if ('solutionLite' in dto && dto.solutionLite !== undefined) {
      sizes.solutionLite = (dto.solutionLite ?? '').length;
    }
    if ('numericPartsJson' in dto && dto.numericPartsJson !== undefined) {
      try {
        sizes.numericParts = JSON.stringify(dto.numericPartsJson ?? []).length;
      } catch {
        // ignore
      }
    }
    if ('choicesJson' in dto && dto.choicesJson !== undefined) {
      try {
        sizes.choices = JSON.stringify(dto.choicesJson ?? []).length;
      } catch {
        // ignore
      }
    }
    if ('correctAnswerJson' in dto && dto.correctAnswerJson !== undefined) {
      try {
        sizes.correctAnswer = JSON.stringify(dto.correctAnswerJson ?? {}).length;
      } catch {
        // ignore
      }
    }

    await this.eventsLogService.append({
      category: EventCategory.admin,
      eventType: 'TaskRevised',
      actorUserId: req.user.id,
      actorRole: req.user.role,
      entityType: 'task',
      entityId: task.id,
      payload: {
        title: task.title,
        status: task.status,
        unitId: task.unitId,
        answerType: task.answerType,
        isRequired: task.isRequired,
        changedFields,
        sizes: Object.keys(sizes).length > 0 ? sizes : undefined,
      },
    });
    return task;
  }

  @Post(':id/publish')
  @HttpCode(200)
  async publish(@Param('id') id: string, @Req() req: AuthRequest) {
    const task = await this.contentService.publishTask(id);
    await this.eventsLogService.append({
      category: EventCategory.admin,
      eventType: 'TaskPublished',
      actorUserId: req.user.id,
      actorRole: req.user.role,
      entityType: 'task',
      entityId: task.id,
      payload: { title: task.title, status: task.status, unitId: task.unitId },
    });
    return task;
  }

  @Post(':id/unpublish')
  @HttpCode(200)
  async unpublish(@Param('id') id: string, @Req() req: AuthRequest) {
    const task = await this.contentService.unpublishTask(id);
    await this.eventsLogService.append({
      category: EventCategory.admin,
      eventType: 'TaskUnpublished',
      actorUserId: req.user.id,
      actorRole: req.user.role,
      entityType: 'task',
      entityId: task.id,
      payload: { title: task.title, status: task.status, unitId: task.unitId },
    });
    return task;
  }

  @Delete(':id')
  async remove(@Param('id') id: string, @Req() req: AuthRequest) {
    const task = await this.contentService.deleteTask(id);
    await this.eventsLogService.append({
      category: EventCategory.admin,
      eventType: 'TaskDeleted',
      actorUserId: req.user.id,
      actorRole: req.user.role,
      entityType: 'task',
      entityId: task.id,
      payload: { title: task.title, status: task.status, unitId: task.unitId },
    });
    return task;
  }
}
