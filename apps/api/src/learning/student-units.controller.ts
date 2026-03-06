import { Controller, Get, Inject, Param, Query, Req, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { StudentUnitRenderedContentResponseSchema } from '@continuum/shared';
import { type AuthRequest } from '../auth/auth.request';
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
    @Inject(LearningService)
    private readonly learningService: LearningService,
    @Inject(ObjectStorageService)
    private readonly objectStorageService: ObjectStorageService,
    @Inject(UnitPdfPolicyService)
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

  @Get(':id/rendered-content')
  async getRenderedContent(
    @Param('id') id: string,
    @Req() req: AuthRequest,
    @Query('target') targetRaw: string | undefined,
    @Query('ttlSec') ttlRaw: string | undefined,
  ) {
    const target = this.unitPdfPolicyService.parseTargetOrThrow(targetRaw);
    const ttlSec = this.unitPdfPolicyService.resolveTtlForRole(Role.student, ttlRaw);
    const state = await this.learningService.getPublishedUnitRenderedAssetStateForStudent(
      req.user.id,
      id,
      target,
    );

    const pdfUrl = state.pdfAssetKey
      ? await this.objectStorageService.getPresignedGetUrl(state.pdfAssetKey, ttlSec, 'application/pdf')
      : null;

    let html: string | null = null;
    if (state.htmlAssetKey) {
      const htmlSource = await this.objectStorageService.getObjectText(state.htmlAssetKey);
      html = await this.replaceAssetPlaceholders(htmlSource, state.htmlAssets, ttlSec);
    }

    return StudentUnitRenderedContentResponseSchema.parse({
      ok: true,
      target,
      html,
      htmlKey: state.htmlAssetKey,
      pdfUrl,
      pdfKey: state.pdfAssetKey,
      expiresInSec: ttlSec,
    });
  }

  private async replaceAssetPlaceholders(
    html: string,
    assets: Array<{ placeholder: string; assetKey: string; contentType: 'image/svg+xml' }>,
    ttlSec: number,
  ) {
    let next = html;
    const sortedAssets = [...assets].sort(
      (left, right) => right.placeholder.length - left.placeholder.length,
    );
    for (const asset of sortedAssets) {
      const url = await this.objectStorageService.presignGetObject(asset.assetKey, ttlSec, asset.contentType);
      next = next.split(asset.placeholder).join(url);
    }
    return next;
  }
}
