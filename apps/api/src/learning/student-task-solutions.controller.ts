import { Controller, Get, Inject, Param, Query, Req, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { StudentTaskSolutionRenderedContentResponseSchema } from '@continuum/shared';
import { type AuthRequest } from '../auth/auth.request';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { UnitPdfPolicyService } from '../content/unit-pdf-policy.service';
import { ObjectStorageService } from '../infra/storage/object-storage.service';
import { LearningService } from './learning.service';

@Controller('student/tasks')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.student)
export class StudentTaskSolutionsController {
  constructor(
    @Inject(LearningService)
    private readonly learningService: LearningService,
    @Inject(ObjectStorageService)
    private readonly objectStorageService: ObjectStorageService,
    @Inject(UnitPdfPolicyService)
    private readonly unitPdfPolicyService: UnitPdfPolicyService,
  ) {}

  @Get(':taskId/solution/rendered-content')
  async getTaskSolutionRenderedContent(
    @Param('taskId') taskId: string,
    @Req() req: AuthRequest,
    @Query('ttlSec') ttlRaw: string | undefined,
  ) {
    const ttlSec = this.unitPdfPolicyService.resolveTtlForRole(Role.student, ttlRaw);
    const taskSolution = await this.learningService.getTaskSolutionRenderedAssetStateForStudent(
      req.user.id,
      taskId,
    );
    const htmlSource = await this.objectStorageService.getObjectText(taskSolution.htmlKey);
    const html = await this.replaceAssetPlaceholders(
      htmlSource,
      taskSolution.htmlAssets,
      ttlSec,
    );

    return StudentTaskSolutionRenderedContentResponseSchema.parse({
      ok: true,
      taskId: taskSolution.taskId,
      taskRevisionId: taskSolution.taskRevisionId,
      html,
      htmlKey: taskSolution.htmlKey,
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
