import { BadRequestException, Controller, Get, Param, Query, Req, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { AuthRequest } from '../auth/auth.request';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { ObjectStorageService } from '../infra/storage/object-storage.service';
import { LearningService } from './learning.service';

@Controller('units')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.student)
export class StudentUnitsController {
  constructor(
    private readonly learningService: LearningService,
    private readonly objectStorageService: ObjectStorageService,
  ) {}

  @Get(':id')
  get(@Param('id') id: string, @Req() req: AuthRequest) {
    return this.learningService.getPublishedUnitForStudent(req.user.id, id);
  }

  @Get(':id/pdf-presign')
  async getPdfPresignedUrl(
    @Param('id') id: string,
    @Req() req: AuthRequest,
    @Query('target') targetRaw: string | undefined,
    @Query('ttlSec') ttlRaw: string | undefined,
  ) {
    const target = this.parseTarget(targetRaw);
    const ttlSec = this.parseTtl(ttlRaw);
    const key = await this.learningService.getPublishedUnitPdfAssetKeyForStudent(req.user.id, id, target);
    if (!key) {
      return {
        ok: true,
        target,
        key: null,
        expiresInSec: ttlSec,
        url: null,
      };
    }

    const url = await this.objectStorageService.getPresignedGetUrl(key, ttlSec);
    return {
      ok: true,
      target,
      key,
      expiresInSec: ttlSec,
      url,
    };
  }

  private parseTarget(value: string | undefined): 'theory' | 'method' {
    if (value === 'theory' || value === 'method') return value;
    throw new BadRequestException('target must be one of: theory | method');
  }

  private parseTtl(raw: string | undefined): number {
    if (raw === undefined || raw === null || raw === '') return 900;
    const parsed = Number(raw);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      throw new BadRequestException('ttlSec must be a positive integer');
    }
    const ttl = Math.floor(parsed);
    if (ttl > 86_400) {
      throw new BadRequestException('ttlSec must be <= 86400');
    }
    return ttl;
  }
}
