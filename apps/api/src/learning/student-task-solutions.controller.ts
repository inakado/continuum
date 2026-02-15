import { Controller, Get, Param, Query, Req, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { AuthRequest } from '../auth/auth.request';
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
    private readonly learningService: LearningService,
    private readonly objectStorageService: ObjectStorageService,
    private readonly unitPdfPolicyService: UnitPdfPolicyService,
  ) {}

  @Get(':taskId/solution/pdf-presign')
  async getTaskSolutionPdfPresignedUrl(
    @Param('taskId') taskId: string,
    @Req() req: AuthRequest,
    @Query('ttlSec') ttlRaw: string | undefined,
  ) {
    const ttlSec = this.unitPdfPolicyService.resolveTtlForRole(Role.student, ttlRaw);
    const taskSolution = await this.learningService.getTaskSolutionPdfAssetKeyForStudent(
      req.user.id,
      taskId,
    );
    const url = await this.objectStorageService.getPresignedGetUrl(
      taskSolution.key,
      ttlSec,
      'application/pdf',
    );

    return {
      ok: true,
      taskId: taskSolution.taskId,
      taskRevisionId: taskSolution.taskRevisionId,
      key: taskSolution.key,
      expiresInSec: ttlSec,
      url,
    };
  }
}
