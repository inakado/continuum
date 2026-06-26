import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { Role } from '@prisma/client';
import {
  BOARD_JSON_CONTENT_TYPE,
  BOARD_PREVIEW_CONTENT_TYPE,
  PHOTO_ALLOWED_CONTENT_TYPES,
  PHOTO_UPLOAD_TTL_DEFAULT_SEC,
  PHOTO_VIEW_TTL_STUDENT_DEFAULT_SEC,
  PHOTO_VIEW_TTL_TEACHER_DEFAULT_SEC,
} from './photo-task-policy.constants';

@Injectable()
export class PhotoTaskPolicyService {
  readonly allowedContentTypes = PHOTO_ALLOWED_CONTENT_TYPES;

  resolveUploadTtl(ttlSec: number | undefined): number {
    return ttlSec ?? PHOTO_UPLOAD_TTL_DEFAULT_SEC;
  }

  resolveViewTtl(role: Role, ttlSec: number | undefined): number {
    if (ttlSec !== undefined) {
      return ttlSec;
    }

    return role === Role.teacher ? PHOTO_VIEW_TTL_TEACHER_DEFAULT_SEC : PHOTO_VIEW_TTL_STUDENT_DEFAULT_SEC;
  }

  assertAssetKeysPrefix(assetKeys: string[], prefix: string) {
    for (const assetKey of assetKeys) {
      this.assertAssetKeyPrefix(assetKey, prefix);
    }
  }

  assertAssetKeysMatchGeneratedPattern(assetKeys: string[], prefix: string) {
    for (const assetKey of assetKeys) {
      this.assertAssetKeyGeneratedPattern(assetKey, prefix);
    }
  }

  assertBoardAssetKeysMatchGeneratedPattern(input: {
    boardAssetKey: string;
    boardPreviewAssetKey: string;
    prefix: string;
  }) {
    this.assertAssetKeyGeneratedPattern(input.boardAssetKey, input.prefix, ['json']);
    this.assertAssetKeyGeneratedPattern(input.boardPreviewAssetKey, input.prefix, ['png']);
  }

  assertTeacherFeedbackBoardAssetKeysMatchGeneratedPattern(input: {
    teacherFeedbackBoardAssetKey: string;
    teacherFeedbackPreviewAssetKey: string;
    prefix: string;
  }) {
    this.assertAssetKeyGeneratedPattern(input.teacherFeedbackBoardAssetKey, input.prefix, ['json']);
    this.assertAssetKeyGeneratedPattern(input.teacherFeedbackPreviewAssetKey, input.prefix, ['png']);
  }

  assertAssetKeyPrefix(assetKey: string, prefix: string) {
    this.assertAssetKeyFormat(assetKey);
    if (!assetKey.startsWith(prefix)) {
      throw new ConflictException({
        code: 'INVALID_ASSET_KEY',
        message: 'assetKey does not belong to this student/task/revision',
      });
    }
  }

  assertAssetKeyGeneratedPattern(assetKey: string, prefix: string, extensions = ['jpg', 'png', 'webp']) {
    this.assertAssetKeyPrefix(assetKey, prefix);
    const suffix = assetKey.slice(prefix.length);
    const allowed = extensions.join('|');
    const pattern = new RegExp(`^\\d{13}-[a-f0-9]{8}-\\d+\\.(${allowed})$`, 'i');
    if (!pattern.test(suffix)) {
      throw new ConflictException({
        code: 'INVALID_ASSET_KEY',
        message: 'assetKey does not match server-generated pattern',
      });
    }
  }

  extensionForContentType(contentType: string): string {
    const normalized = this.normalizeContentType(contentType);
    if (normalized === 'image/jpeg') return 'jpg';
    if (normalized === 'image/png') return 'png';
    if (normalized === 'image/webp') return 'webp';

    throw new BadRequestException({
      code: 'INVALID_FILE_TYPE',
      message: `contentType must be one of: ${PHOTO_ALLOWED_CONTENT_TYPES.join(', ')}`,
    });
  }

  inferResponseContentType(assetKey: string): string | undefined {
    const lowered = assetKey.toLowerCase();
    if (lowered.endsWith('.jpg') || lowered.endsWith('.jpeg')) return 'image/jpeg';
    if (lowered.endsWith('.png')) return 'image/png';
    if (lowered.endsWith('.webp')) return 'image/webp';
    if (lowered.endsWith('.json')) return 'application/json';
    return undefined;
  }

  boardJsonContentType(): string {
    return BOARD_JSON_CONTENT_TYPE;
  }

  boardPreviewContentType(): string {
    return BOARD_PREVIEW_CONTENT_TYPE;
  }

  private normalizeContentType(raw: unknown): string {
    return typeof raw === 'string' ? raw.trim().toLowerCase() : '';
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
