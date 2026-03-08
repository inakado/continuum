import { randomBytes } from 'node:crypto';
import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { Role } from '@prisma/client';
import {
  CONTENT_COVER_IMAGE_ALLOWED_CONTENT_TYPES,
  CONTENT_COVER_IMAGE_MAX_SIZE_BYTES,
  CONTENT_COVER_IMAGE_TTL_MAX_SEC,
  CONTENT_COVER_IMAGE_UPLOAD_TTL_DEFAULT_SEC,
  CONTENT_COVER_IMAGE_VIEW_TTL_STUDENT_DEFAULT_SEC,
  CONTENT_COVER_IMAGE_VIEW_TTL_TEACHER_DEFAULT_SEC,
} from './content-cover-image-policy.constants';

export type ContentCoverImageUploadFileInput = {
  filename: string;
  contentType: string;
  sizeBytes: number;
};

type ContentCoverEntity = 'course' | 'section';

@Injectable()
export class ContentCoverImagePolicyService {
  readonly allowedContentTypes = CONTENT_COVER_IMAGE_ALLOWED_CONTENT_TYPES;

  resolveUploadTtl(raw: unknown): number {
    return this.resolveTtl(raw, CONTENT_COVER_IMAGE_UPLOAD_TTL_DEFAULT_SEC);
  }

  resolveViewTtl(role: Role, raw: unknown): number {
    const fallback =
      role === Role.teacher
        ? CONTENT_COVER_IMAGE_VIEW_TTL_TEACHER_DEFAULT_SEC
        : CONTENT_COVER_IMAGE_VIEW_TTL_STUDENT_DEFAULT_SEC;
    return this.resolveTtl(raw, fallback);
  }

  parseUploadFile(raw: unknown): ContentCoverImageUploadFileInput {
    if (!raw || typeof raw !== 'object') {
      throw new BadRequestException({
        code: 'INVALID_FILE_TYPE',
        message: 'file payload is invalid',
      });
    }

    const item = raw as Record<string, unknown>;
    const filename = typeof item.filename === 'string' ? item.filename.trim() : '';
    const contentType = this.normalizeContentType(item.contentType);
    const sizeBytes = Number(item.sizeBytes);

    if (!filename) {
      throw new BadRequestException({
        code: 'INVALID_FILE_TYPE',
        message: 'filename is required',
      });
    }

    if (
      !CONTENT_COVER_IMAGE_ALLOWED_CONTENT_TYPES.includes(
        contentType as (typeof CONTENT_COVER_IMAGE_ALLOWED_CONTENT_TYPES)[number],
      )
    ) {
      throw new BadRequestException({
        code: 'INVALID_FILE_TYPE',
        message: `contentType must be one of: ${CONTENT_COVER_IMAGE_ALLOWED_CONTENT_TYPES.join(', ')}`,
      });
    }

    if (!Number.isFinite(sizeBytes) || !Number.isInteger(sizeBytes) || sizeBytes <= 0) {
      throw new BadRequestException({
        code: 'FILE_TOO_LARGE',
        message: 'sizeBytes must be a positive integer',
      });
    }

    if (sizeBytes > CONTENT_COVER_IMAGE_MAX_SIZE_BYTES) {
      throw new BadRequestException({
        code: 'FILE_TOO_LARGE',
        message: `max file size is ${CONTENT_COVER_IMAGE_MAX_SIZE_BYTES} bytes`,
      });
    }

    return { filename, contentType, sizeBytes };
  }

  parseAssetKey(raw: unknown): string {
    const assetKey = typeof raw === 'string' ? raw.trim() : '';
    if (!assetKey) {
      throw new ConflictException({
        code: 'INVALID_ASSET_KEY',
        message: 'assetKey is required',
      });
    }

    this.assertAssetKeyFormat(assetKey);
    return assetKey;
  }

  buildCourseAssetPrefix(courseId: string): string {
    return this.buildAssetPrefix('course', courseId);
  }

  buildSectionAssetPrefix(sectionId: string): string {
    return this.buildAssetPrefix('section', sectionId);
  }

  createCourseAssetKey(courseId: string, contentType: string): string {
    return this.createAssetKey('course', courseId, contentType);
  }

  createSectionAssetKey(sectionId: string, contentType: string): string {
    return this.createAssetKey('section', sectionId, contentType);
  }

  assertAssetKeyGeneratedPattern(assetKey: string, prefix: string) {
    this.assertAssetKeyPrefix(assetKey, prefix);
    const suffix = assetKey.slice(prefix.length);
    if (!/^\d{13}-[a-f0-9]{8}\.(jpg|png|webp)$/i.test(suffix)) {
      throw new ConflictException({
        code: 'INVALID_ASSET_KEY',
        message: 'assetKey does not match server-generated pattern',
      });
    }
  }

  inferResponseContentType(assetKey: string): string | undefined {
    const lowered = assetKey.toLowerCase();
    if (lowered.endsWith('.jpg') || lowered.endsWith('.jpeg')) return 'image/jpeg';
    if (lowered.endsWith('.png')) return 'image/png';
    if (lowered.endsWith('.webp')) return 'image/webp';
    return undefined;
  }

  private buildAssetPrefix(entity: ContentCoverEntity, entityId: string) {
    return entity === 'course'
      ? `courses/${entityId}/cover/`
      : `sections/${entityId}/cover/`;
  }

  private createAssetKey(entity: ContentCoverEntity, entityId: string, contentType: string) {
    const ext = this.extensionForContentType(contentType);
    const prefix = this.buildAssetPrefix(entity, entityId);
    return `${prefix}${Date.now()}-${randomBytes(4).toString('hex')}.${ext}`;
  }

  private extensionForContentType(contentType: string): string {
    const normalized = this.normalizeContentType(contentType);
    if (normalized === 'image/jpeg') return 'jpg';
    if (normalized === 'image/png') return 'png';
    if (normalized === 'image/webp') return 'webp';

    throw new BadRequestException({
      code: 'INVALID_FILE_TYPE',
      message: `contentType must be one of: ${CONTENT_COVER_IMAGE_ALLOWED_CONTENT_TYPES.join(', ')}`,
    });
  }

  private resolveTtl(raw: unknown, fallback: number): number {
    if (raw === undefined || raw === null || raw === '') return fallback;

    const parsed = Number(raw);
    if (!Number.isFinite(parsed) || !Number.isInteger(parsed) || parsed <= 0) {
      throw new BadRequestException({
        code: 'INVALID_TTL',
        message: 'ttlSec must be a positive integer',
      });
    }

    if (parsed > CONTENT_COVER_IMAGE_TTL_MAX_SEC) {
      throw new BadRequestException({
        code: 'TTL_TOO_LARGE',
        message: `ttlSec must be <= ${CONTENT_COVER_IMAGE_TTL_MAX_SEC}`,
      });
    }

    return parsed;
  }

  private normalizeContentType(raw: unknown): string {
    return typeof raw === 'string' ? raw.trim().toLowerCase() : '';
  }

  private assertAssetKeyPrefix(assetKey: string, prefix: string) {
    this.assertAssetKeyFormat(assetKey);
    if (!assetKey.startsWith(prefix)) {
      throw new ConflictException({
        code: 'INVALID_ASSET_KEY',
        message: 'assetKey does not belong to this entity',
      });
    }
  }

  private assertAssetKeyFormat(assetKey: string) {
    if (!assetKey || assetKey.length > 500 || !/^[a-zA-Z0-9\-_/\.]+$/.test(assetKey)) {
      throw new ConflictException({
        code: 'INVALID_ASSET_KEY',
        message: 'assetKey format is invalid',
      });
    }
  }
}
