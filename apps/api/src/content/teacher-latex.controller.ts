import {
  Body,
  ConflictException,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  Inject,
  NotFoundException,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { EventCategory, Role } from '@prisma/client';
import type { Job } from 'bullmq';
import { type AuthRequest } from '../auth/auth.request';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import {
  teacherLatexTtlQueryExceptionFactory,
  teacherTaskSolutionLatexCompileExceptionFactory,
  teacherUnitLatexCompileExceptionFactory,
} from '../common/validation/zod-exception-factories';
import { EventsLogService } from '../events/events-log.service';
import { ObjectStorageService } from '../infra/storage/object-storage.service';
import { ContentService } from './content.service';
import {
  isDebugLatexCompileJobPayload,
  isDebugLatexCompileJobResult,
  isTaskSolutionLatexCompileJobPayload,
  isTaskSolutionLatexCompileJobResult,
  isUnitLatexCompileJobPayload,
  isUnitLatexCompileJobResult,
  parseLatexCompileJobPayloadOrThrow,
  parseLatexCompileJobResultOrThrow,
  TeacherLatexTtlQuerySchema,
  TeacherTaskSolutionLatexCompileRequestSchema,
  TeacherUnitLatexCompileRequestSchema,
  type TeacherLatexTtlQuery,
  type TeacherTaskSolutionLatexCompileRequest,
  type TeacherUnitLatexCompileRequest,
} from './latex-boundary.contracts';
import { LatexCompileQueueService } from './latex-compile-queue.service';
import {
  type LatexCompileJobError,
  type LatexCompileQueuePayload,
  TASK_SOLUTION_PDF_TARGET,
  shouldApplyIncomingUnitRender,
  shouldApplyIncomingPdfKey,
} from './unit-pdf.constants';
import { UnitPdfPolicyService } from './unit-pdf-policy.service';

@Controller('teacher')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.teacher)
export class TeacherLatexController {
  constructor(
    @Inject(ContentService)
    private readonly contentService: ContentService,
    @Inject(LatexCompileQueueService)
    private readonly queueService: LatexCompileQueueService,
    @Inject(ObjectStorageService)
    private readonly objectStorageService: ObjectStorageService,
    @Inject(UnitPdfPolicyService)
    private readonly unitPdfPolicyService: UnitPdfPolicyService,
    @Inject(EventsLogService)
    private readonly eventsLogService: EventsLogService,
  ) {}

  @Post('units/:id/latex/compile')
  @HttpCode(202)
  async enqueueCompile(
    @Param('id') unitId: string,
    @Req() req: AuthRequest,
    @Body(
      new ZodValidationPipe(
        TeacherUnitLatexCompileRequestSchema,
        teacherUnitLatexCompileExceptionFactory,
      ),
    )
    body: TeacherUnitLatexCompileRequest,
  ) {
    await this.contentService.getUnit(unitId);
    const target = this.unitPdfPolicyService.parseTargetOrThrow(body.target);
    const ttlSec = this.unitPdfPolicyService.resolveTtlForRole(Role.teacher, body.ttlSec);

    const jobId = await this.queueService.enqueueUnitPdfCompile({
      unitId,
      target,
      tex: body.tex,
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
    @Body(
      new ZodValidationPipe(
        TeacherTaskSolutionLatexCompileRequestSchema,
        teacherTaskSolutionLatexCompileExceptionFactory,
      ),
    )
    body: TeacherTaskSolutionLatexCompileRequest,
  ) {
    const task = await this.contentService.getTaskForSolutionPdfCompile(taskId);
    const ttlSec = this.unitPdfPolicyService.resolveTtlForRole(Role.teacher, body.ttlSec);
    await this.contentService.updateTaskRevisionSolutionRichLatex(task.activeRevisionId, body.latex);

    const jobId = await this.queueService.enqueueTaskSolutionPdfCompile({
      taskId: task.id,
      taskRevisionId: task.activeRevisionId,
      target: TASK_SOLUTION_PDF_TARGET,
      tex: body.latex,
      requestedByUserId: req.user.id,
      requestedByRole: Role.teacher,
      ttlSec,
    });

    return { jobId };
  }

  @Get('tasks/:taskId/solution/pdf-presign')
  async getTaskSolutionPdfPresignedUrl(
    @Param('taskId') taskId: string,
    @Query(
      new ZodValidationPipe(
        TeacherLatexTtlQuerySchema,
        teacherLatexTtlQueryExceptionFactory,
      ),
    )
    query: TeacherLatexTtlQuery,
  ) {
    const ttlSec = this.unitPdfPolicyService.resolveTtlForRole(Role.teacher, query.ttlSec);
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
    @Query(
      new ZodValidationPipe(
        TeacherLatexTtlQuerySchema,
        teacherLatexTtlQueryExceptionFactory,
      ),
    )
    query: TeacherLatexTtlQuery,
  ) {
    const ttlSec = this.unitPdfPolicyService.resolveTtlForRole(Role.teacher, query.ttlSec);
    const job = await this.requireJob(jobId);
    const payload = parseLatexCompileJobPayloadOrThrow(job.data);
    this.assertTeacherOwnsJob(payload, req.user.id);

    const rawState = await job.getState();
    const status = this.mapJobState(rawState);

    if (status === 'succeeded') {
      const result = parseLatexCompileJobResultOrThrow(job.returnvalue);
      const previewKey = isUnitLatexCompileJobResult(result) ? result.pdfAssetKey : result.assetKey;
      const presignedUrl = await this.objectStorageService.getPresignedGetUrl(
        previewKey,
        ttlSec,
        'application/pdf',
      );
      return {
        jobId: String(job.id ?? jobId),
        status,
        assetKey: previewKey,
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
    const payload = parseLatexCompileJobPayloadOrThrow(job.data);
    this.assertTeacherOwnsJob(payload, req.user.id);

    const rawState = await job.getState();
    const status = this.mapJobState(rawState);
    if (status !== 'succeeded') {
      throw new ConflictException({
        code: 'LATEX_JOB_NOT_SUCCEEDED',
        message: 'Only succeeded compile jobs can be applied',
      });
    }

    const result = parseLatexCompileJobResultOrThrow(job.returnvalue);

    if (isUnitLatexCompileJobPayload(payload) && isUnitLatexCompileJobResult(result)) {
      const unit = await this.contentService.getUnit(payload.unitId);
      const currentKey = payload.target === 'theory' ? unit.theoryPdfAssetKey : unit.methodPdfAssetKey;
      const currentHtmlKey = payload.target === 'theory' ? unit.theoryHtmlAssetKey : unit.methodHtmlAssetKey;
      if (currentKey === result.pdfAssetKey && currentHtmlKey === result.htmlAssetKey) {
        return {
          ok: true,
          applied: false,
          reason: 'already_applied',
          unitId: payload.unitId,
          target: payload.target,
          assetKey: result.assetKey,
        };
      }
      if (
        !shouldApplyIncomingUnitRender(
          currentKey,
          currentHtmlKey,
          result.pdfAssetKey,
          result.htmlAssetKey,
        )
      ) {
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
          ? {
              theoryPdfAssetKey: result.pdfAssetKey,
              theoryHtmlAssetKey: result.htmlAssetKey,
              theoryHtmlAssetsJson: result.htmlAssets,
            }
          : {
              methodPdfAssetKey: result.pdfAssetKey,
              methodHtmlAssetKey: result.htmlAssetKey,
              methodHtmlAssetsJson: result.htmlAssets,
            };
      await this.contentService.updateUnit(payload.unitId, patch);

      return {
        ok: true,
        applied: true,
        unitId: payload.unitId,
        target: payload.target,
        assetKey: result.pdfAssetKey,
      };
    }

    if (isTaskSolutionLatexCompileJobPayload(payload) && isTaskSolutionLatexCompileJobResult(result)) {
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

    if (isDebugLatexCompileJobPayload(payload) && isDebugLatexCompileJobResult(result)) {
      throw new ConflictException({
        code: 'LATEX_JOB_APPLY_UNSUPPORTED',
        message: 'Debug compile jobs cannot be applied',
      });
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

  private parseFailedReason(raw: unknown): LatexCompileJobError {
    if (typeof raw === 'string' && raw.trim()) {
      try {
        const parsed = JSON.parse(raw) as {
          code?: unknown;
          message?: unknown;
          log?: unknown;
          logTruncated?: unknown;
          logLimitBytes?: unknown;
          logSnippet?: unknown;
        };
        if (typeof parsed.code === 'string' && typeof parsed.message === 'string') {
          const log = typeof parsed.log === 'string' && parsed.log ? parsed.log : undefined;
          const logSnippet =
            typeof parsed.logSnippet === 'string' && parsed.logSnippet
              ? parsed.logSnippet
              : log;
          return {
            code: parsed.code,
            message: parsed.message,
            ...(log ? { log } : null),
            ...(parsed.logTruncated === true ? { logTruncated: true } : null),
            ...(typeof parsed.logLimitBytes === 'number' &&
            Number.isFinite(parsed.logLimitBytes) &&
            parsed.logLimitBytes > 0
              ? { logLimitBytes: Math.floor(parsed.logLimitBytes) }
              : null),
            ...(logSnippet ? { logSnippet } : null),
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

}
