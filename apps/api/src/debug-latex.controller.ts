import {
  BadRequestException,
  Body,
  Controller,
  HttpCode,
  Inject,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { type AuthRequest } from './auth/auth.request';
import { Roles } from './auth/decorators/roles.decorator';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { RolesGuard } from './auth/guards/roles.guard';
import { LatexCompileQueueService } from './content/latex-compile-queue.service';
import { DEBUG_PDF_TARGET } from './content/unit-pdf.constants';

type CompileAndUploadRequest = {
  tex?: unknown;
  target?: unknown;
  ttlSec?: unknown;
};

type LatexTarget = 'theory' | 'method';

@Controller('teacher/debug/latex')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.teacher)
export class DebugLatexController {
  constructor(
    @Inject(LatexCompileQueueService)
    private readonly queueService: LatexCompileQueueService,
  ) {}

  @Post('compile-and-upload')
  @HttpCode(202)
  async compileAndUpload(@Req() req: AuthRequest, @Body() payload: CompileAndUploadRequest) {
    const tex = this.requireString(payload.tex, 'tex');
    const debugTarget = this.parseTarget(payload.target);
    const ttlSec = this.parseTtl(payload.ttlSec);

    const jobId = await this.queueService.enqueueDebugPdfCompile({
      target: DEBUG_PDF_TARGET,
      debugTarget,
      tex,
      ttlSec,
      requestedByUserId: req.user.id,
      requestedByRole: Role.teacher,
    });
    return {
      jobId,
      statusUrl: `/teacher/latex/jobs/${jobId}`,
    };
  }

  private requireString(value: unknown, fieldName: string): string {
    if (typeof value !== 'string' || !value.trim()) {
      throw new BadRequestException({
        code: 'INVALID_REQUEST',
        message: `${fieldName} must be a non-empty string`,
      });
    }
    return value;
  }

  private parseTarget(value: unknown): LatexTarget {
    if (value === undefined || value === null) return 'theory';
    if (value === 'theory' || value === 'method') return value;
    throw new BadRequestException({
      code: 'INVALID_REQUEST',
      message: 'target must be one of: theory | method',
    });
  }

  private parseTtl(value: unknown): number {
    if (value === undefined || value === null || value === '') return 900;
    if (typeof value !== 'number' && typeof value !== 'string') {
      throw new BadRequestException({
        code: 'INVALID_REQUEST',
        message: 'ttlSec must be a positive integer',
      });
    }

    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      throw new BadRequestException({
        code: 'INVALID_REQUEST',
        message: 'ttlSec must be a positive integer',
      });
    }

    const ttlSec = Math.floor(parsed);
    if (ttlSec > 86_400) {
      throw new BadRequestException({
        code: 'INVALID_REQUEST',
        message: 'ttlSec must be <= 86400',
      });
    }
    return ttlSec;
  }
}
