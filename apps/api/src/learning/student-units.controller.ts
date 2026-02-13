import { Controller, Get, Param, Query, Req, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { AuthRequest } from '../auth/auth.request';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { UnitPdfPolicyService } from '../content/unit-pdf-policy.service';
import { ObjectStorageService } from '../infra/storage/object-storage.service';
import { LearningService } from './learning.service';

@Controller('units')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.student)
export class StudentUnitsController {
  constructor(
    private readonly learningService: LearningService,
    private readonly objectStorageService: ObjectStorageService,
    private readonly unitPdfPolicyService: UnitPdfPolicyService,
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
    const target = this.unitPdfPolicyService.parseTargetOrThrow(targetRaw);
    const ttlSec = this.unitPdfPolicyService.resolveTtlForRole(Role.student, ttlRaw);
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

    const url = await this.objectStorageService.getPresignedGetUrl(key, ttlSec, 'application/pdf');
    return {
      ok: true,
      target,
      key,
      expiresInSec: ttlSec,
      url,
    };
  }
}
