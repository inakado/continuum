import { Controller, Get, Inject, Query, Req, UseGuards } from '@nestjs/common';
import {
  ContentCoverImagePresignViewQuerySchema,
  StudentDashboardOverviewResponseSchema,
  type ContentCoverImagePresignViewQuery,
} from '@continuum/shared';
import { Role } from '@prisma/client';
import { type AuthRequest } from '../auth/auth.request';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { contentCoverImageViewExceptionFactory } from '../common/validation/zod-exception-factories';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { ContentCoverImagePolicyService } from '../content/content-cover-image-policy.service';
import { ObjectStorageService } from '../infra/storage/object-storage.service';
import { LearningService } from './learning.service';

@Controller('student/dashboard')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.student)
export class StudentDashboardController {
  constructor(
    @Inject(LearningService)
    private readonly learningService: LearningService,
    @Inject(ObjectStorageService)
    private readonly objectStorageService: ObjectStorageService,
    @Inject(ContentCoverImagePolicyService)
    private readonly contentCoverImagePolicyService: ContentCoverImagePolicyService,
  ) {}

  @Get()
  async getOverview(
    @Req() req: AuthRequest,
    @Query(
      new ZodValidationPipe(
        ContentCoverImagePresignViewQuerySchema,
        contentCoverImageViewExceptionFactory,
      ),
    )
    query: ContentCoverImagePresignViewQuery,
  ) {
    const ttlSec = this.contentCoverImagePolicyService.resolveViewTtl(Role.student, query.ttlSec);
    const overview = await this.learningService.getStudentDashboardOverview(req.user.id);

    const courses = await Promise.all(
      overview.courses.map(async (course) => {
        if (!course.coverImageAssetKey) {
          return {
            ...course,
            coverImageKey: null,
            coverImageUrl: null,
          };
        }

        const responseContentType = this.contentCoverImagePolicyService.inferResponseContentType(
          course.coverImageAssetKey,
        );
        const coverImageUrl = await this.objectStorageService.presignGetObject(
          course.coverImageAssetKey,
          ttlSec,
          responseContentType,
        );

        return {
          ...course,
          coverImageKey: course.coverImageAssetKey,
          coverImageUrl,
        };
      }),
    );

    return StudentDashboardOverviewResponseSchema.parse({
      courses,
      continueLearning: overview.continueLearning,
      stats: overview.stats,
    });
  }
}
