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
import { Role } from '@prisma/client';
import { Job } from 'bullmq';
import { AuthRequest } from '../auth/auth.request';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { ObjectStorageService } from '../infra/storage/object-storage.service';
import { ContentService } from './content.service';
import { LatexCompileQueueService } from './latex-compile-queue.service';
import {
  LATEX_MAX_SOURCE_LENGTH,
  LatexCompileJobResult,
  LatexCompileQueuePayload,
  shouldApplyIncomingUnitPdfKey,
  UnitPdfTarget,
} from './unit-pdf.constants';
import { UnitPdfPolicyService } from './unit-pdf-policy.service';

type CompileRequestBody = {
  target?: unknown;
  tex?: unknown;
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
    if (!shouldApplyIncomingUnitPdfKey(currentKey, result.assetKey)) {
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
      unitId: payload.unitId,
      target: payload.target,
      assetKey: result.assetKey,
    };
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

  private isTarget(value: unknown): value is UnitPdfTarget {
    return value === 'theory' || value === 'method';
  }
}
