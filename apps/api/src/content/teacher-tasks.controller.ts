import {
  Body,
  ConflictException,
  Controller,
  Delete,
  Get,
  HttpCode,
  NotFoundException,
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
import { LearningRecomputeService } from '../learning/learning-recompute.service';
import { ContentService } from './content.service';
import { CreateTaskDto, UpdateTaskDto } from './dto/task.dto';
import { TaskStatementImagePolicyService } from './task-statement-image-policy.service';
import { ObjectStorageService } from '../infra/storage/object-storage.service';

@Controller('teacher/tasks')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.teacher)
export class TeacherTasksController {
  constructor(
    private readonly contentService: ContentService,
    private readonly eventsLogService: EventsLogService,
    private readonly learningRecomputeService: LearningRecomputeService,
    private readonly objectStorageService: ObjectStorageService,
    private readonly taskStatementImagePolicyService: TaskStatementImagePolicyService,
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
    await this.learningRecomputeService.recomputeForTask(task.id);
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
    await this.learningRecomputeService.recomputeForTask(task.id);
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

  @Post(':taskId/statement-image/presign-upload')
  @HttpCode(200)
  async presignStatementImageUpload(@Param('taskId') taskId: string, @Body() body: unknown) {
    const state = await this.contentService.getTaskStatementImageState(taskId);
    const payload = this.asRecord(body);
    const file = this.taskStatementImagePolicyService.parseUploadFile(
      this.asRecord(payload.file).filename ? payload.file : body,
    );
    const ttlSec = this.taskStatementImagePolicyService.resolveUploadTtl(payload.ttlSec);
    const assetKey = this.taskStatementImagePolicyService.createAssetKey(
      state.taskId,
      state.activeRevisionId,
      file.contentType,
    );
    const presigned = await this.objectStorageService.presignPutObject(assetKey, file.contentType, ttlSec);

    return {
      uploadUrl: presigned.url,
      assetKey,
      headers: presigned.headers,
      expiresInSec: ttlSec,
    };
  }

  @Post(':taskId/statement-image/apply')
  @HttpCode(200)
  async applyStatementImage(@Param('taskId') taskId: string, @Body() body: unknown) {
    const state = await this.contentService.getTaskStatementImageState(taskId);
    const payload = this.asRecord(body);
    const assetKey = this.taskStatementImagePolicyService.parseAssetKey(payload.assetKey);
    const prefix = this.taskStatementImagePolicyService.buildAssetPrefix(
      state.taskId,
      state.activeRevisionId,
    );
    this.taskStatementImagePolicyService.assertAssetKeyGeneratedPattern(assetKey, prefix);

    const objectMeta = await this.objectStorageService.getObjectMeta(assetKey);
    if (!objectMeta.exists) {
      throw new ConflictException({
        code: 'INVALID_ASSET_KEY',
        message: 'assetKey object is not found',
      });
    }

    const updated = await this.contentService.setTaskRevisionStatementImageAssetKey(
      state.activeRevisionId,
      assetKey,
    );

    return {
      ok: true,
      taskId: state.taskId,
      taskRevisionId: state.activeRevisionId,
      assetKey: updated.statementImageAssetKey,
    };
  }

  @Delete(':taskId/statement-image')
  @HttpCode(200)
  async deleteStatementImage(@Param('taskId') taskId: string) {
    const state = await this.contentService.getTaskStatementImageState(taskId);
    await this.contentService.setTaskRevisionStatementImageAssetKey(state.activeRevisionId, null);

    return {
      ok: true,
      taskId: state.taskId,
      taskRevisionId: state.activeRevisionId,
      assetKey: null,
    };
  }

  @Get(':taskId/statement-image/presign-view')
  async presignStatementImageView(
    @Param('taskId') taskId: string,
    @Query('ttlSec') ttlRaw: string | undefined,
  ) {
    const ttlSec = this.taskStatementImagePolicyService.resolveViewTtl(Role.teacher, ttlRaw);
    const state = await this.contentService.getTaskStatementImageState(taskId);
    if (!state.statementImageAssetKey) {
      throw new NotFoundException({
        code: 'STATEMENT_IMAGE_MISSING',
        message: 'Task statement image is not uploaded yet',
      });
    }

    const responseContentType = this.taskStatementImagePolicyService.inferResponseContentType(
      state.statementImageAssetKey,
    );
    const url = await this.objectStorageService.presignGetObject(
      state.statementImageAssetKey,
      ttlSec,
      responseContentType,
    );

    return {
      ok: true,
      taskId: state.taskId,
      taskRevisionId: state.activeRevisionId,
      key: state.statementImageAssetKey,
      expiresInSec: ttlSec,
      url,
    };
  }

  private asRecord(value: unknown): Record<string, unknown> {
    return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
  }
}
