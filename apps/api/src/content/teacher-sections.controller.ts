import {
  Body,
  ConflictException,
  Controller,
  Delete,
  Get,
  HttpCode,
  Inject,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { EventCategory, Role } from '@prisma/client';
import {
  ContentCoverImageApplyRequestSchema,
  ContentCoverImagePresignViewQuerySchema,
  TeacherContentCoverImagePresignUploadRequestSchema,
  type ContentCoverImageApplyRequest,
  type ContentCoverImagePresignViewQuery,
  type TeacherContentCoverImagePresignUploadRequest,
} from '@continuum/shared';
import { type AuthRequest } from '../auth/auth.request';
import {
  contentCoverImageApplyExceptionFactory,
  contentCoverImageUploadExceptionFactory,
  contentCoverImageViewExceptionFactory,
} from '../common/validation/zod-exception-factories';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { EventsLogService } from '../events/events-log.service';
import { ObjectStorageService } from '../infra/storage/object-storage.service';
import { ContentCoverImagePolicyService } from './content-cover-image-policy.service';
import { ContentService } from './content.service';
import { type CreateSectionDto, type UpdateSectionDto } from './dto/section.dto';

@Controller('teacher/sections')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.teacher)
export class TeacherSectionsController {
  constructor(
    @Inject(ContentService)
    private readonly contentService: ContentService,
    @Inject(EventsLogService)
    private readonly eventsLogService: EventsLogService,
    @Inject(ObjectStorageService)
    private readonly objectStorageService: ObjectStorageService,
    @Inject(ContentCoverImagePolicyService)
    private readonly contentCoverImagePolicyService: ContentCoverImagePolicyService,
  ) {}

  @Get(':id')
  get(@Param('id') id: string) {
    return this.contentService.getSection(id);
  }

  @Get(':id/meta')
  getMeta(@Param('id') id: string) {
    return this.contentService.getSectionMeta(id);
  }

  @Post()
  async create(@Body() dto: CreateSectionDto, @Req() req: AuthRequest) {
    const section = await this.contentService.createSection(dto);
    await this.eventsLogService.append({
      category: EventCategory.admin,
      eventType: 'SectionCreated',
      actorUserId: req.user.id,
      actorRole: req.user.role,
      entityType: 'section',
      entityId: section.id,
      payload: {
        title: section.title,
        status: section.status,
        courseId: section.courseId,
        sortOrder: section.sortOrder,
      },
    });
    return section;
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateSectionDto,
    @Req() req: AuthRequest,
  ) {
    const section = await this.contentService.updateSection(id, dto);
    await this.eventsLogService.append({
      category: EventCategory.admin,
      eventType: 'SectionUpdated',
      actorUserId: req.user.id,
      actorRole: req.user.role,
      entityType: 'section',
      entityId: section.id,
      payload: {
        title: section.title,
        status: section.status,
        courseId: section.courseId,
        sortOrder: section.sortOrder,
        changes: dto,
      },
    });
    return section;
  }

  @Post(':id/publish')
  @HttpCode(200)
  async publish(@Param('id') id: string, @Req() req: AuthRequest) {
    const section = await this.contentService.publishSection(id);
    await this.eventsLogService.append({
      category: EventCategory.admin,
      eventType: 'SectionPublished',
      actorUserId: req.user.id,
      actorRole: req.user.role,
      entityType: 'section',
      entityId: section.id,
      payload: {
        title: section.title,
        status: section.status,
        courseId: section.courseId,
      },
    });
    return section;
  }

  @Post(':id/unpublish')
  @HttpCode(200)
  async unpublish(@Param('id') id: string, @Req() req: AuthRequest) {
    const section = await this.contentService.unpublishSection(id);
    await this.eventsLogService.append({
      category: EventCategory.admin,
      eventType: 'SectionUnpublished',
      actorUserId: req.user.id,
      actorRole: req.user.role,
      entityType: 'section',
      entityId: section.id,
      payload: {
        title: section.title,
        status: section.status,
        courseId: section.courseId,
      },
    });
    return section;
  }

  @Delete(':id')
  async remove(@Param('id') id: string, @Req() req: AuthRequest) {
    const section = await this.contentService.deleteSection(id);
    await this.eventsLogService.append({
      category: EventCategory.admin,
      eventType: 'SectionDeleted',
      actorUserId: req.user.id,
      actorRole: req.user.role,
      entityType: 'section',
      entityId: section.id,
      payload: {
        title: section.title,
        status: section.status,
        courseId: section.courseId,
      },
    });
    return section;
  }

  @Post(':sectionId/cover-image/presign-upload')
  @HttpCode(200)
  async presignCoverImageUpload(
    @Param('sectionId') sectionId: string,
    @Body(
      new ZodValidationPipe(
        TeacherContentCoverImagePresignUploadRequestSchema,
        contentCoverImageUploadExceptionFactory,
      ),
    )
    body: TeacherContentCoverImagePresignUploadRequest,
  ) {
    const state = await this.contentService.getSectionCoverImageState(sectionId);
    const file = body.file;
    const ttlSec = this.contentCoverImagePolicyService.resolveUploadTtl(body.ttlSec);
    const assetKey = this.contentCoverImagePolicyService.createSectionAssetKey(
      state.sectionId,
      file.contentType,
    );
    const presigned = await this.objectStorageService.presignPutObject(assetKey, file.contentType, ttlSec);

    return {
      uploadUrl: presigned.url,
      assetKey,
      headers: presigned.headers,
      expiresInSec: ttlSec,
    };
  }

  @Post(':sectionId/cover-image/apply')
  @HttpCode(200)
  async applyCoverImage(
    @Param('sectionId') sectionId: string,
    @Body(
      new ZodValidationPipe(
        ContentCoverImageApplyRequestSchema,
        contentCoverImageApplyExceptionFactory,
      ),
    )
    body: ContentCoverImageApplyRequest,
  ) {
    const state = await this.contentService.getSectionCoverImageState(sectionId);
    const assetKey = body.assetKey;
    const prefix = this.contentCoverImagePolicyService.buildSectionAssetPrefix(state.sectionId);
    this.contentCoverImagePolicyService.assertAssetKeyGeneratedPattern(assetKey, prefix);

    const objectMeta = await this.objectStorageService.getObjectMeta(assetKey);
    if (!objectMeta.exists) {
      throw new ConflictException({
        code: 'INVALID_ASSET_KEY',
        message: 'assetKey object is not found',
      });
    }

    const updated = await this.contentService.setSectionCoverImageAssetKey(state.sectionId, assetKey);
    return {
      ok: true,
      sectionId: updated.id,
      assetKey: updated.coverImageAssetKey,
    };
  }

  @Delete(':sectionId/cover-image')
  @HttpCode(200)
  async deleteCoverImage(@Param('sectionId') sectionId: string) {
    const state = await this.contentService.getSectionCoverImageState(sectionId);
    await this.contentService.setSectionCoverImageAssetKey(state.sectionId, null);

    return {
      ok: true,
      sectionId: state.sectionId,
      assetKey: null,
    };
  }

  @Get(':sectionId/cover-image/presign-view')
  async presignCoverImageView(
    @Param('sectionId') sectionId: string,
    @Query(
      new ZodValidationPipe(
        ContentCoverImagePresignViewQuerySchema,
        contentCoverImageViewExceptionFactory,
      ),
    )
    query: ContentCoverImagePresignViewQuery,
  ) {
    const ttlSec = this.contentCoverImagePolicyService.resolveViewTtl(Role.teacher, query.ttlSec);
    const state = await this.contentService.getSectionCoverImageState(sectionId);
    if (!state.coverImageAssetKey) {
      throw new NotFoundException({
        code: 'COVER_IMAGE_MISSING',
        message: 'Section cover image is not uploaded yet',
      });
    }

    const responseContentType = this.contentCoverImagePolicyService.inferResponseContentType(
      state.coverImageAssetKey,
    );
    const url = await this.objectStorageService.presignGetObject(
      state.coverImageAssetKey,
      ttlSec,
      responseContentType,
    );

    return {
      ok: true,
      sectionId: state.sectionId,
      key: state.coverImageAssetKey,
      expiresInSec: ttlSec,
      url,
    };
  }
}
