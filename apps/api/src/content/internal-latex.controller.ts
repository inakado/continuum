import {
  Body,
  ConflictException,
  Controller,
  Headers,
  HttpCode,
  Inject,
  NotFoundException,
  Param,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import { EventCategory } from '@prisma/client';
import type { Job } from 'bullmq';
import { EventsLogService } from '../events/events-log.service';
import { ContentService } from './content.service';
import {
  isTaskSolutionLatexCompileJobPayload,
  isTaskSolutionLatexCompileJobResult,
  isUnitLatexCompileJobPayload,
  isUnitLatexCompileJobResult,
  parseLatexCompileJobPayloadOrThrow,
  parseLatexCompileJobResultOrThrow,
} from './latex-boundary.contracts';
import { LatexCompileQueueService } from './latex-compile-queue.service';
import {
  type LatexCompileJobResult,
  shouldApplyIncomingUnitRender,
  shouldApplyIncomingPdfKey,
} from './unit-pdf.constants';

@Controller('internal/latex/jobs')
export class InternalLatexController {
  constructor(
    @Inject(ContentService)
    private readonly contentService: ContentService,
    @Inject(LatexCompileQueueService)
    private readonly queueService: LatexCompileQueueService,
    @Inject(EventsLogService)
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
    const payload = parseLatexCompileJobPayloadOrThrow(job.data);

    const result = this.parseResultForAutoApply(job, body);
    if (isUnitLatexCompileJobPayload(payload) && isUnitLatexCompileJobResult(result)) {
      const unit = await this.contentService.getUnit(payload.unitId);
      const currentKey = payload.target === 'theory' ? unit.theoryPdfAssetKey : unit.methodPdfAssetKey;
      const currentHtmlKey = payload.target === 'theory' ? unit.theoryHtmlAssetKey : unit.methodHtmlAssetKey;

      if (currentKey === result.pdfAssetKey && currentHtmlKey === result.htmlAssetKey) {
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
          jobId: String(job.id ?? jobId),
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
        jobId: String(job.id ?? jobId),
        unitId: payload.unitId,
        target: payload.target,
        assetKey: result.pdfAssetKey,
      };
    }

    if (isTaskSolutionLatexCompileJobPayload(payload) && isTaskSolutionLatexCompileJobResult(result)) {
      const state = await this.contentService.getTaskSolutionRenderedState(payload.taskId);
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

      if (state.solutionHtmlAssetKey === result.assetKey) {
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

      if (!shouldApplyIncomingPdfKey(state.solutionHtmlAssetKey, result.assetKey)) {
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

      await this.contentService.setTaskRevisionSolutionRenderedAssets(
        state.activeRevisionId,
        result.assetKey,
        result.htmlAssets,
      );
      await this.eventsLogService.append({
        category: EventCategory.admin,
        eventType: 'TaskSolutionHtmlCompiled',
        actorUserId: payload.requestedByUserId,
        actorRole: payload.requestedByRole,
        entityType: 'task_revision',
        entityId: state.activeRevisionId,
        payload: {
          task_id: payload.taskId,
          task_revision_id: state.activeRevisionId,
          target: payload.target,
          asset_key: result.assetKey,
          html_assets_count: result.htmlAssets.length,
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

  private parseResultForAutoApply(job: Job, rawBody: unknown): LatexCompileJobResult {
    if (rawBody && typeof rawBody === 'object') {
      return parseLatexCompileJobResultOrThrow(rawBody);
    }

    if (job.returnvalue && typeof job.returnvalue === 'object') {
      return parseLatexCompileJobResultOrThrow(job.returnvalue);
    }

    const progress = job.progress as
      | { autoApplyResult?: unknown }
      | undefined;
    if (progress && typeof progress === 'object' && progress.autoApplyResult) {
      return parseLatexCompileJobResultOrThrow(progress.autoApplyResult);
    }

    throw new ConflictException({
      code: 'LATEX_JOB_RESULT_INVALID',
      message: 'Compile job result is not available yet',
    });
  }

}
