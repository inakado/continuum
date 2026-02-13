import { BadRequestException, Body, Controller, HttpCode, Post, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { createHash } from 'node:crypto';
import { Roles } from './auth/decorators/roles.decorator';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { RolesGuard } from './auth/guards/roles.guard';
import { LatexCompileService } from './infra/latex/latex-compile.service';
import { ObjectStorageService } from './infra/storage/object-storage.service';

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
    private readonly latexCompileService: LatexCompileService,
    private readonly objectStorageService: ObjectStorageService,
  ) {}

  @Post('compile-and-upload')
  @HttpCode(200)
  async compileAndUpload(@Body() payload: CompileAndUploadRequest) {
    const tex = this.requireString(payload.tex, 'tex');
    const target = this.parseTarget(payload.target);
    const ttlSec = this.parseTtl(payload.ttlSec);

    const compile = await this.latexCompileService.compileToPdf(tex);

    const timestamp = new Date().toISOString().replace(/[-:.TZ]/g, '');
    const hash = createHash('sha256').update(tex).digest('hex').slice(0, 12);
    const key = `units/debug/${target}/${timestamp}-${hash}.pdf`;

    const uploaded = await this.objectStorageService.putObject({
      key,
      contentType: 'application/pdf',
      body: compile.pdfBytes,
      cacheControl: 'no-store',
    });

    const presignedUrl = await this.objectStorageService.getPresignedGetUrl(key, ttlSec);

    return {
      key,
      sizeBytes: compile.pdfBytes.length,
      presignedUrl,
      ...(uploaded.etag ? { etag: uploaded.etag } : null),
      ...(compile.logSnippet ? { compileLogSnippet: compile.logSnippet } : null),
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
