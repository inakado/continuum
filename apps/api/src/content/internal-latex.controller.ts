import {
  Body,
  ConflictException,
  Controller,
  Headers,
  HttpCode,
  NotFoundException,
  Param,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import { EventCategory, Role } from '@prisma/client';
import { Job } from 'bullmq';
import { EventsLogService } from '../events/events-log.service';
import { ContentService } from './content.service';
import { LatexCompileQueueService } from './latex-compile-queue.service';
import {
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

@Controller('internal/latex/jobs')
export class InternalLatexController {
  constructor(
    private readonly contentService: ContentService,
    private readonly queueService: LatexCompileQueueService,
    private readonly eventsLogService: EventsLogService,
  ) {}

  @Post(':jobId/apply')
  @HttpCode(200)
  async applyCompileJob(
    @Param('jobId') jobId: string,
    @Headers('x-internal-token') token: string | undefined,
    @Body() body: unknown,
  ) {
    this.assertInternalToken(token);
    const job = await this.requireJob(jobId);
    const payload = this.parseJobPayload(job.data);

    const result = this.parseResultForAutoApply(job, body);
    if (this.isUnitPayload(payload) && this.isUnitResult(result)) {
      const unit = await this.contentService.getUnit(payload.unitId);
      const currentKey = payload.target === 'theory' ? unit.theoryPdfAssetKey : unit.methodPdfAssetKey;

      if (currentKey === result.assetKey) {
        return {
          ok: true,
          applied: false,
          reason: 'already_applied',
          jobId: String(job.id ?? jobId),
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
          jobId: String(job.id ?? jobId),
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
        jobId: String(job.id ?? jobId),
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
          jobId: String(job.id ?? jobId),
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
          jobId: String(job.id ?? jobId),
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
          jobId: String(job.id ?? jobId),
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
        actorUserId: payload.requestedByUserId,
        actorRole: payload.requestedByRole,
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
        jobId: String(job.id ?? jobId),
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

  private assertInternalToken(token: string | undefined) {
    const expected = process.env.WORKER_INTERNAL_TOKEN || 'continuum-internal-dev';
    if (!token || token !== expected) {
      throw new UnauthorizedException({
        code: 'INTERNAL_TOKEN_INVALID',
        message: 'invalid internal token',
      });
    }
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

  private parseResultForAutoApply(job: Job, rawBody: unknown): LatexCompileJobResult {
    if (rawBody && typeof rawBody === 'object') {
      return this.parseJobResult(rawBody);
    }

    if (job.returnvalue && typeof job.returnvalue === 'object') {
      return this.parseJobResult(job.returnvalue);
    }

    const progress = job.progress as
      | { autoApplyResult?: unknown }
      | undefined;
    if (progress && typeof progress === 'object' && progress.autoApplyResult) {
      return this.parseJobResult(progress.autoApplyResult);
    }

    throw new ConflictException({
      code: 'LATEX_JOB_RESULT_INVALID',
      message: 'Compile job result is not available yet',
    });
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
