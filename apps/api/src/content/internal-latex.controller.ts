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
import { Role } from '@prisma/client';
import { Job } from 'bullmq';
import { ContentService } from './content.service';
import { LatexCompileQueueService } from './latex-compile-queue.service';
import {
  LatexCompileJobResult,
  LatexCompileQueuePayload,
  shouldApplyIncomingUnitPdfKey,
  UnitPdfTarget,
} from './unit-pdf.constants';

@Controller('internal/latex/jobs')
export class InternalLatexController {
  constructor(
    private readonly contentService: ContentService,
    private readonly queueService: LatexCompileQueueService,
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

    if (!shouldApplyIncomingUnitPdfKey(currentKey, result.assetKey)) {
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

    const payload = raw as Partial<LatexCompileQueuePayload>;
    if (
      typeof payload.unitId !== 'string' ||
      !payload.unitId ||
      !this.isTarget(payload.target) ||
      typeof payload.requestedByUserId !== 'string' ||
      payload.requestedByRole !== Role.teacher
    ) {
      throw new ConflictException({
        code: 'LATEX_JOB_PAYLOAD_INVALID',
        message: 'Job payload is missing required fields',
      });
    }

    if (typeof payload.ttlSec !== 'number' || !Number.isInteger(payload.ttlSec) || payload.ttlSec <= 0) {
      throw new ConflictException({
        code: 'LATEX_JOB_PAYLOAD_INVALID',
        message: 'Job payload ttlSec is invalid',
      });
    }

    if (typeof payload.tex !== 'string' || !payload.tex.trim()) {
      throw new ConflictException({
        code: 'LATEX_JOB_PAYLOAD_INVALID',
        message: 'Job payload tex is invalid',
      });
    }

    return payload as LatexCompileQueuePayload;
  }

  private parseJobResult(raw: unknown): LatexCompileJobResult {
    if (!raw || typeof raw !== 'object') {
      throw new ConflictException({
        code: 'LATEX_JOB_RESULT_INVALID',
        message: 'Job result is missing or malformed',
      });
    }

    const result = raw as Partial<LatexCompileJobResult>;
    if (
      typeof result.unitId !== 'string' ||
      !result.unitId ||
      !this.isTarget(result.target) ||
      typeof result.assetKey !== 'string' ||
      !result.assetKey
    ) {
      throw new ConflictException({
        code: 'LATEX_JOB_RESULT_INVALID',
        message: 'Job result is missing required fields',
      });
    }

    if (typeof result.sizeBytes !== 'number' || result.sizeBytes <= 0) {
      throw new ConflictException({
        code: 'LATEX_JOB_RESULT_INVALID',
        message: 'Job result sizeBytes is invalid',
      });
    }

    return result as LatexCompileJobResult;
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

  private isTarget(value: unknown): value is UnitPdfTarget {
    return value === 'theory' || value === 'method';
  }
}
