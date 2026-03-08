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
import { type CreateCourseDto, type UpdateCourseDto } from './dto/course.dto';

@Controller('teacher/courses')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.teacher)
export class TeacherCoursesController {
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

  @Get()
  list() {
    return this.contentService.listCourses();
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.contentService.getCourse(id);
  }

  @Post()
  async create(@Body() dto: CreateCourseDto, @Req() req: AuthRequest) {
    const course = await this.contentService.createCourse(dto);
    await this.eventsLogService.append({
      category: EventCategory.admin,
      eventType: 'CourseCreated',
      actorUserId: req.user.id,
      actorRole: req.user.role,
      entityType: 'course',
      entityId: course.id,
      payload: { title: course.title, status: course.status },
    });
    return course;
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateCourseDto, @Req() req: AuthRequest) {
    const course = await this.contentService.updateCourse(id, dto);
    await this.eventsLogService.append({
      category: EventCategory.admin,
      eventType: 'CourseUpdated',
      actorUserId: req.user.id,
      actorRole: req.user.role,
      entityType: 'course',
      entityId: course.id,
      payload: { title: course.title, status: course.status, changes: dto },
    });
    return course;
  }

  @Post(':id/publish')
  @HttpCode(200)
  async publish(@Param('id') id: string, @Req() req: AuthRequest) {
    const course = await this.contentService.publishCourse(id);
    await this.eventsLogService.append({
      category: EventCategory.admin,
      eventType: 'CoursePublished',
      actorUserId: req.user.id,
      actorRole: req.user.role,
      entityType: 'course',
      entityId: course.id,
      payload: { title: course.title, status: course.status },
    });
    return course;
  }

  @Post(':id/unpublish')
  @HttpCode(200)
  async unpublish(@Param('id') id: string, @Req() req: AuthRequest) {
    const course = await this.contentService.unpublishCourse(id);
    await this.eventsLogService.append({
      category: EventCategory.admin,
      eventType: 'CourseUnpublished',
      actorUserId: req.user.id,
      actorRole: req.user.role,
      entityType: 'course',
      entityId: course.id,
      payload: { title: course.title, status: course.status },
    });
    return course;
  }

  @Delete(':id')
  async remove(@Param('id') id: string, @Req() req: AuthRequest) {
    const course = await this.contentService.deleteCourse(id);
    await this.eventsLogService.append({
      category: EventCategory.admin,
      eventType: 'CourseDeleted',
      actorUserId: req.user.id,
      actorRole: req.user.role,
      entityType: 'course',
      entityId: course.id,
      payload: { title: course.title, status: course.status },
    });
    return course;
  }

  @Post(':courseId/cover-image/presign-upload')
  @HttpCode(200)
  async presignCoverImageUpload(
    @Param('courseId') courseId: string,
    @Body(
      new ZodValidationPipe(
        TeacherContentCoverImagePresignUploadRequestSchema,
        contentCoverImageUploadExceptionFactory,
      ),
    )
    body: TeacherContentCoverImagePresignUploadRequest,
  ) {
    const state = await this.contentService.getCourseCoverImageState(courseId);
    const file = body.file;
    const ttlSec = this.contentCoverImagePolicyService.resolveUploadTtl(body.ttlSec);
    const assetKey = this.contentCoverImagePolicyService.createCourseAssetKey(
      state.courseId,
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

  @Post(':courseId/cover-image/apply')
  @HttpCode(200)
  async applyCoverImage(
    @Param('courseId') courseId: string,
    @Body(
      new ZodValidationPipe(
        ContentCoverImageApplyRequestSchema,
        contentCoverImageApplyExceptionFactory,
      ),
    )
    body: ContentCoverImageApplyRequest,
  ) {
    const state = await this.contentService.getCourseCoverImageState(courseId);
    const assetKey = body.assetKey;
    const prefix = this.contentCoverImagePolicyService.buildCourseAssetPrefix(state.courseId);
    this.contentCoverImagePolicyService.assertAssetKeyGeneratedPattern(assetKey, prefix);

    const objectMeta = await this.objectStorageService.getObjectMeta(assetKey);
    if (!objectMeta.exists) {
      throw new ConflictException({
        code: 'INVALID_ASSET_KEY',
        message: 'assetKey object is not found',
      });
    }

    const updated = await this.contentService.setCourseCoverImageAssetKey(state.courseId, assetKey);
    return {
      ok: true,
      courseId: updated.id,
      assetKey: updated.coverImageAssetKey,
    };
  }

  @Delete(':courseId/cover-image')
  @HttpCode(200)
  async deleteCoverImage(@Param('courseId') courseId: string) {
    const state = await this.contentService.getCourseCoverImageState(courseId);
    await this.contentService.setCourseCoverImageAssetKey(state.courseId, null);

    return {
      ok: true,
      courseId: state.courseId,
      assetKey: null,
    };
  }

  @Get(':courseId/cover-image/presign-view')
  async presignCoverImageView(
    @Param('courseId') courseId: string,
    @Query(
      new ZodValidationPipe(
        ContentCoverImagePresignViewQuerySchema,
        contentCoverImageViewExceptionFactory,
      ),
    )
    query: ContentCoverImagePresignViewQuery,
  ) {
    const ttlSec = this.contentCoverImagePolicyService.resolveViewTtl(Role.teacher, query.ttlSec);
    const state = await this.contentService.getCourseCoverImageState(courseId);
    if (!state.coverImageAssetKey) {
      throw new NotFoundException({
        code: 'COVER_IMAGE_MISSING',
        message: 'Course cover image is not uploaded yet',
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
      courseId: state.courseId,
      key: state.coverImageAssetKey,
      expiresInSec: ttlSec,
      url,
    };
  }
}
