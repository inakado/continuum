import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { EventCategory, Role } from '@prisma/client';
import { Job } from 'bullmq';
import { AuthRequest } from '../auth/auth.request';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { EventsLogService } from '../events/events-log.service';
import { ObjectStorageService } from '../infra/storage/object-storage.service';
import { ContentService } from './content.service';
import { LatexCompileQueueService } from './latex-compile-queue.service';
import {
  LATEX_MAX_SOURCE_LENGTH,
  LatexCompileJobResult,
  LatexCompileQueuePayload,
  TaskSolutionLatexCompileJobResult,
  TaskSolutionLatexCompileQueuePayload,
  TASK_SOLUTION_PDF_TARGET,
  UnitLatexCompileJobResult,
  UnitLatexCompileQueuePayload,
  shouldApplyIncomingPdfKey,
  UnitPdfTarget,
} from './unit-pdf.constants';
import { UnitPdfPolicyService } from './unit-pdf-policy.service';

type CompileRequestBody = {
  target?: unknown;
  tex?: unknown;
  ttlSec?: unknown;
};

type TaskSolutionCompileRequestBody = {
  latex?: unknown;
  ttlSec?: unknown;
};

@Controller('teacher')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.teacher)
export class TeacherLatexController {
  constructor(
    private readonly contentService: ContentService,
    private readonly queueService: LatexCompileQueueService,
    private readonly objectStorageService: ObjectStorageService,
    private readonly unitPdfPolicyService: UnitPdfPolicyService,
    private readonly eventsLogService: EventsLogService,
  ) {}

  @Post('units/:id/latex/compile')
  @HttpCode(202)
  async enqueueCompile(
    @Param('id') unitId: string,
    @Req() req: AuthRequest,
    @Body() body: CompileRequestBody,
  ) {
    await this.contentService.getUnit(unitId);
    const target = this.unitPdfPolicyService.parseTargetOrThrow(body?.target);
    const tex = this.parseTexOrThrow(body?.tex);
    const ttlSec = this.unitPdfPolicyService.resolveTtlForRole(Role.teacher, body?.ttlSec);

    const jobId = await this.queueService.enqueueUnitPdfCompile({
      unitId,
      target,
      tex,
      requestedByUserId: req.user.id,
      requestedByRole: Role.teacher,
      ttlSec,
    });

    return { jobId };
  }

  @Post('tasks/:taskId/solution/latex/compile')
  @HttpCode(202)
  async enqueueTaskSolutionCompile(
    @Param('taskId') taskId: string,
    @Req() req: AuthRequest,
    @Body() body: TaskSolutionCompileRequestBody,
  ) {
    const task = await this.contentService.getTaskForSolutionPdfCompile(taskId);
    const latex = this.parseLatexOrThrow(body?.latex);
    const ttlSec = this.unitPdfPolicyService.resolveTtlForRole(Role.teacher, body?.ttlSec);
    await this.contentService.updateTaskRevisionSolutionRichLatex(task.activeRevisionId, latex);

    const jobId = await this.queueService.enqueueTaskSolutionPdfCompile({
      taskId: task.id,
      taskRevisionId: task.activeRevisionId,
      target: TASK_SOLUTION_PDF_TARGET,
      tex: latex,
      requestedByUserId: req.user.id,
      requestedByRole: Role.teacher,
      ttlSec,
    });

    return { jobId };
  }

  @Get('tasks/:taskId/solution/pdf-presign')
  async getTaskSolutionPdfPresignedUrl(
    @Param('taskId') taskId: string,
    @Query('ttlSec') ttlRaw: string | undefined,
  ) {
    const ttlSec = this.unitPdfPolicyService.resolveTtlForRole(Role.teacher, ttlRaw);
    const state = await this.contentService.getTaskSolutionPdfState(taskId);
    if (!state.solutionPdfAssetKey) {
      throw new NotFoundException({
        code: 'SOLUTION_PDF_MISSING',
        message: 'Task solution PDF is not compiled yet',
      });
    }

    const url = await this.objectStorageService.getPresignedGetUrl(
      state.solutionPdfAssetKey,
      ttlSec,
      'application/pdf',
    );

    return {
      ok: true,
      taskId: state.taskId,
      taskRevisionId: state.activeRevisionId,
      key: state.solutionPdfAssetKey,
      expiresInSec: ttlSec,
      url,
    };
  }

  @Get('latex/jobs/:jobId')
  async getCompileJob(
    @Param('jobId') jobId: string,
    @Req() req: AuthRequest,
    @Query('ttlSec') ttlRaw: string | undefined,
  ) {
    const ttlSec = this.unitPdfPolicyService.resolveTtlForRole(Role.teacher, ttlRaw);
    const job = await this.requireJob(jobId);
    const payload = this.parseJobPayload(job.data);
    this.assertTeacherOwnsJob(payload, req.user.id);

    const rawState = await job.getState();
    const status = this.mapJobState(rawState);

    if (status === 'succeeded') {
      const result = this.parseJobResult(job.returnvalue);
      const presignedUrl = await this.objectStorageService.getPresignedGetUrl(
        result.assetKey,
        ttlSec,
        'application/pdf',
      );
      return {
        jobId: String(job.id ?? jobId),
        status,
        assetKey: result.assetKey,
        presignedUrl,
      };
    }

    if (status === 'failed') {
      return {
        jobId: String(job.id ?? jobId),
        status,
        error: this.parseFailedReason(job.failedReason),
      };
    }

    return {
      jobId: String(job.id ?? jobId),
      status,
    };
  }

  @Post('latex/jobs/:jobId/apply')
  @HttpCode(200)
  async applyCompileJob(@Param('jobId') jobId: string, @Req() req: AuthRequest) {
    const job = await this.requireJob(jobId);
    const payload = this.parseJobPayload(job.data);
    this.assertTeacherOwnsJob(payload, req.user.id);

    const rawState = await job.getState();
    const status = this.mapJobState(rawState);
    if (status !== 'succeeded') {
      throw new ConflictException({
        code: 'LATEX_JOB_NOT_SUCCEEDED',
        message: 'Only succeeded compile jobs can be applied',
      });
    }

    const result = this.parseJobResult(job.returnvalue);

    if (this.isUnitPayload(payload) && this.isUnitResult(result)) {
      const unit = await this.contentService.getUnit(payload.unitId);
      const currentKey = payload.target === 'theory' ? unit.theoryPdfAssetKey : unit.methodPdfAssetKey;
      if (currentKey === result.assetKey) {
        return {
          ok: true,
          applied: false,
          reason: 'already_applied',
          unitId: payload.unitId,
          target: payload.target,
          assetKey: result.assetKey,
        };
      }
      if (!shouldApplyIncomingPdfKey(currentKey, result.assetKey)) {
        return {
          ok: true,
          applied: false,
          reason: 'stale',
          unitId: payload.unitId,
          target: payload.target,
          assetKey: result.assetKey,
        };
      }

      const patch =
        payload.target === 'theory'
          ? { theoryPdfAssetKey: result.assetKey }
          : { methodPdfAssetKey: result.assetKey };
      await this.contentService.updateUnit(payload.unitId, patch);

      return {
        ok: true,
        applied: true,
        unitId: payload.unitId,
        target: payload.target,
        assetKey: result.assetKey,
      };
    }

    if (this.isTaskSolutionPayload(payload) && this.isTaskSolutionResult(result)) {
      const state = await this.contentService.getTaskSolutionPdfState(payload.taskId);
      if (state.activeRevisionId !== payload.taskRevisionId) {
        return {
          ok: true,
          applied: false,
          reason: 'stale',
          taskId: payload.taskId,
          taskRevisionId: payload.taskRevisionId,
          activeRevisionId: state.activeRevisionId,
          target: payload.target,
          assetKey: result.assetKey,
        };
      }
      if (state.solutionPdfAssetKey === result.assetKey) {
        return {
          ok: true,
          applied: false,
          reason: 'already_applied',
          taskId: payload.taskId,
          taskRevisionId: payload.taskRevisionId,
          target: payload.target,
          assetKey: result.assetKey,
        };
      }
      if (!shouldApplyIncomingPdfKey(state.solutionPdfAssetKey, result.assetKey)) {
        return {
          ok: true,
          applied: false,
          reason: 'stale',
          taskId: payload.taskId,
          taskRevisionId: payload.taskRevisionId,
          target: payload.target,
          assetKey: result.assetKey,
        };
      }

      await this.contentService.setTaskRevisionSolutionPdfAssetKey(state.activeRevisionId, result.assetKey);
      await this.eventsLogService.append({
        category: EventCategory.admin,
        eventType: 'TaskSolutionPdfCompiled',
        actorUserId: req.user.id,
        actorRole: req.user.role,
        entityType: 'task_revision',
        entityId: state.activeRevisionId,
        payload: {
          task_id: payload.taskId,
          task_revision_id: state.activeRevisionId,
          target: payload.target,
          asset_key: result.assetKey,
          job_id: String(job.id ?? jobId),
        },
      });

      return {
        ok: true,
        applied: true,
        taskId: payload.taskId,
        taskRevisionId: state.activeRevisionId,
        target: payload.target,
        assetKey: result.assetKey,
      };
    }

    throw new ConflictException({
      code: 'LATEX_JOB_RESULT_INVALID',
      message: 'Job payload and result target mismatch',
    });
  }

  private async requireJob(jobId: string): Promise<Job> {
    const job = await this.queueService.getJob(jobId);
    if (!job) {
      throw new NotFoundException({
        code: 'LATEX_JOB_NOT_FOUND',
        message: 'Compile job not found',
      });
    }
    return job;
  }

  private assertTeacherOwnsJob(payload: LatexCompileQueuePayload, teacherId: string) {
    if (payload.requestedByUserId !== teacherId) {
      throw new ForbiddenException({
        code: 'LATEX_JOB_FORBIDDEN',
        message: 'Job does not belong to current teacher',
      });
    }
  }

  private mapJobState(state: string): 'queued' | 'running' | 'succeeded' | 'failed' {
    if (state === 'completed') return 'succeeded';
    if (state === 'failed') return 'failed';
    if (state === 'active') return 'running';
    return 'queued';
  }

  private parseTexOrThrow(value: unknown): string {
    if (typeof value !== 'string' || !value.trim()) {
      throw new BadRequestException({
        code: 'INVALID_LATEX_INPUT',
        message: 'tex must be a non-empty string',
      });
    }

    if (value.length > LATEX_MAX_SOURCE_LENGTH) {
      throw new BadRequestException({
        code: 'LATEX_TOO_LARGE',
        message: `tex exceeds max length (${LATEX_MAX_SOURCE_LENGTH})`,
      });
    }

    return value;
  }

  private parseLatexOrThrow(value: unknown): string {
    if (typeof value !== 'string' || !value.trim()) {
      throw new BadRequestException({
        code: 'INVALID_LATEX_INPUT',
        message: 'latex must be a non-empty string',
      });
    }

    if (value.length > LATEX_MAX_SOURCE_LENGTH) {
      throw new BadRequestException({
        code: 'LATEX_TOO_LARGE',
        message: `latex exceeds max length (${LATEX_MAX_SOURCE_LENGTH})`,
      });
    }

    return value;
  }

  private parseJobPayload(raw: unknown): LatexCompileQueuePayload {
    if (!raw || typeof raw !== 'object') {
      throw new ConflictException({
        code: 'LATEX_JOB_PAYLOAD_INVALID',
        message: 'Job payload is missing or malformed',
      });
    }

    const payload = raw as Record<string, unknown>;
    const requestedByUserId = typeof payload.requestedByUserId === 'string' ? payload.requestedByUserId : null;
    const requestedByRole = payload.requestedByRole;
    const tex = typeof payload.tex === 'string' ? payload.tex : null;
    const ttlSec = payload.ttlSec;

    if (!requestedByUserId || requestedByRole !== Role.teacher) {
      throw new ConflictException({
        code: 'LATEX_JOB_PAYLOAD_INVALID',
        message: 'Job payload is missing required fields',
      });
    }

    if (typeof ttlSec !== 'number' || !Number.isInteger(ttlSec) || ttlSec <= 0) {
      throw new ConflictException({
        code: 'LATEX_JOB_PAYLOAD_INVALID',
        message: 'Job payload ttlSec is invalid',
      });
    }

    if (!tex || !tex.trim()) {
      throw new ConflictException({
        code: 'LATEX_JOB_PAYLOAD_INVALID',
        message: 'Job payload tex is invalid',
      });
    }

    if (this.isUnitTarget(payload.target)) {
      const unitId = typeof payload.unitId === 'string' ? payload.unitId : '';
      if (!unitId) {
        throw new ConflictException({
          code: 'LATEX_JOB_PAYLOAD_INVALID',
          message: 'Job payload unitId is invalid',
        });
      }
      return {
        target: payload.target,
        unitId,
        tex,
        requestedByUserId,
        requestedByRole: Role.teacher,
        ttlSec,
      };
    }

    if (payload.target === TASK_SOLUTION_PDF_TARGET) {
      const taskId = typeof payload.taskId === 'string' ? payload.taskId : '';
      const taskRevisionId = typeof payload.taskRevisionId === 'string' ? payload.taskRevisionId : '';
      if (
        !taskId ||
        !taskRevisionId
      ) {
        throw new ConflictException({
          code: 'LATEX_JOB_PAYLOAD_INVALID',
          message: 'Job payload task fields are invalid',
        });
      }
      return {
        target: TASK_SOLUTION_PDF_TARGET,
        taskId,
        taskRevisionId,
        tex,
        requestedByUserId,
        requestedByRole: Role.teacher,
        ttlSec,
      };
    }

    throw new ConflictException({
      code: 'LATEX_JOB_PAYLOAD_INVALID',
      message: 'Job payload target is invalid',
    });
  }

  private parseJobResult(raw: unknown): LatexCompileJobResult {
    if (!raw || typeof raw !== 'object') {
      throw new ConflictException({
        code: 'LATEX_JOB_RESULT_INVALID',
        message: 'Job result is missing or malformed',
      });
    }

    const result = raw as Record<string, unknown>;
    const assetKey = typeof result.assetKey === 'string' ? result.assetKey : '';
    const sizeBytes = result.sizeBytes;
    const compileLogSnippet = typeof result.compileLogSnippet === 'string' ? result.compileLogSnippet : undefined;

    if (!assetKey) {
      throw new ConflictException({
        code: 'LATEX_JOB_RESULT_INVALID',
        message: 'Job result is missing required fields',
      });
    }

    if (typeof sizeBytes !== 'number' || sizeBytes <= 0) {
      throw new ConflictException({
        code: 'LATEX_JOB_RESULT_INVALID',
        message: 'Job result sizeBytes is invalid',
      });
    }

    if (this.isUnitTarget(result.target)) {
      const unitId = typeof result.unitId === 'string' ? result.unitId : '';
      if (!unitId) {
        throw new ConflictException({
          code: 'LATEX_JOB_RESULT_INVALID',
          message: 'Job result unitId is invalid',
        });
      }
      return {
        target: result.target,
        unitId,
        assetKey,
        sizeBytes,
        ...(compileLogSnippet ? { compileLogSnippet } : null),
      };
    }

    if (result.target === TASK_SOLUTION_PDF_TARGET) {
      const taskId = typeof result.taskId === 'string' ? result.taskId : '';
      const taskRevisionId = typeof result.taskRevisionId === 'string' ? result.taskRevisionId : '';
      if (
        !taskId ||
        !taskRevisionId
      ) {
        throw new ConflictException({
          code: 'LATEX_JOB_RESULT_INVALID',
          message: 'Job result task fields are invalid',
        });
      }
      return {
        target: TASK_SOLUTION_PDF_TARGET,
        taskId,
        taskRevisionId,
        assetKey,
        sizeBytes,
        ...(compileLogSnippet ? { compileLogSnippet } : null),
      };
    }

    throw new ConflictException({
      code: 'LATEX_JOB_RESULT_INVALID',
      message: 'Job result target is invalid',
    });
  }

  private parseFailedReason(raw: unknown): { code: string; message: string; logSnippet?: string } {
    if (typeof raw === 'string' && raw.trim()) {
      try {
        const parsed = JSON.parse(raw) as { code?: unknown; message?: unknown; logSnippet?: unknown };
        if (typeof parsed.code === 'string' && typeof parsed.message === 'string') {
          return {
            code: parsed.code,
            message: parsed.message,
            ...(typeof parsed.logSnippet === 'string' && parsed.logSnippet
              ? { logSnippet: parsed.logSnippet }
              : null),
          };
        }
      } catch {
        return {
          code: 'LATEX_COMPILE_FAILED',
          message: raw,
        };
      }

      return {
        code: 'LATEX_COMPILE_FAILED',
        message: raw,
      };
    }

    return {
      code: 'LATEX_COMPILE_FAILED',
      message: 'Compile job failed',
    };
  }

  private isUnitTarget(value: unknown): value is UnitPdfTarget {
    return value === 'theory' || value === 'method';
  }

  private isUnitPayload(payload: LatexCompileQueuePayload): payload is UnitLatexCompileQueuePayload {
    return this.isUnitTarget(payload.target);
  }

  private isTaskSolutionPayload(
    payload: LatexCompileQueuePayload,
  ): payload is TaskSolutionLatexCompileQueuePayload {
    return payload.target === TASK_SOLUTION_PDF_TARGET;
  }

  private isUnitResult(result: LatexCompileJobResult): result is UnitLatexCompileJobResult {
    return this.isUnitTarget(result.target);
  }

  private isTaskSolutionResult(
    result: LatexCompileJobResult,
  ): result is TaskSolutionLatexCompileJobResult {
    return result.target === TASK_SOLUTION_PDF_TARGET;
  }
}
