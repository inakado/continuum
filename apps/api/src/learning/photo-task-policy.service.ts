import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { Role } from '@prisma/client';
import {
  PHOTO_ALLOWED_CONTENT_TYPES,
  PHOTO_FILES_MAX,
  PHOTO_FILES_MIN,
  PHOTO_MAX_SIZE_BYTES,
  PHOTO_TTL_MAX_SEC,
  PHOTO_UPLOAD_TTL_DEFAULT_SEC,
  PHOTO_VIEW_TTL_STUDENT_DEFAULT_SEC,
  PHOTO_VIEW_TTL_TEACHER_DEFAULT_SEC,
} from './photo-task-policy.constants';

export type PhotoUploadFileInput = {
  filename: string;
  contentType: string;
  sizeBytes: number;
};

@Injectable()
export class PhotoTaskPolicyService {
  readonly allowedContentTypes = PHOTO_ALLOWED_CONTENT_TYPES;

  resolveUploadTtl(raw: unknown): number {
    return this.resolveTtl(raw, PHOTO_UPLOAD_TTL_DEFAULT_SEC);
  }

  resolveViewTtl(role: Role, raw: unknown): number {
    const fallback =
      role === Role.teacher ? PHOTO_VIEW_TTL_TEACHER_DEFAULT_SEC : PHOTO_VIEW_TTL_STUDENT_DEFAULT_SEC;
    return this.resolveTtl(raw, fallback);
  }

  validatePresignFiles(raw: unknown): PhotoUploadFileInput[] {
    if (!Array.isArray(raw)) {
      throw new BadRequestException({
        code: 'TOO_MANY_FILES',
        message: `files count must be between ${PHOTO_FILES_MIN} and ${PHOTO_FILES_MAX}`,
      });
    }

    const files = raw.map((item) => this.parseFile(item));
    this.assertFileCount(files.length);
    return files;
  }

  parseAssetKeys(raw: unknown): string[] {
    if (!Array.isArray(raw)) {
      throw new ConflictException({
        code: 'INVALID_ASSET_KEY',
        message: 'assetKeys must be a non-empty array',
      });
    }

    const keys = raw
      .map((item) => (typeof item === 'string' ? item.trim() : ''))
      .filter((item) => item.length > 0);

    this.assertFileCount(keys.length);

    const unique = Array.from(new Set(keys));
    if (unique.length !== keys.length) {
      throw new ConflictException({
        code: 'INVALID_ASSET_KEY',
        message: 'assetKeys must be unique',
      });
    }

    unique.forEach((key) => this.assertAssetKeyFormat(key));
    return unique;
  }

  parseSingleAssetKey(raw: unknown): string {
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

  assertAssetKeyPrefix(assetKey: string, prefix: string) {
    this.assertAssetKeyFormat(assetKey);
    if (!assetKey.startsWith(prefix)) {
      throw new ConflictException({
        code: 'INVALID_ASSET_KEY',
        message: 'assetKey does not belong to this student/task/revision',
      });
    }
  }

  assertAssetKeyGeneratedPattern(assetKey: string, prefix: string) {
    this.assertAssetKeyPrefix(assetKey, prefix);
    const suffix = assetKey.slice(prefix.length);
    if (!/^\d{13}-[a-f0-9]{8}-\d+\.(jpg|png|webp)$/i.test(suffix)) {
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
    return undefined;
  }

  private parseFile(raw: unknown): PhotoUploadFileInput {
    if (!raw || typeof raw !== 'object') {
      throw new BadRequestException({
        code: 'INVALID_FILE_TYPE',
        message: 'files[] item is invalid',
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

    if (!PHOTO_ALLOWED_CONTENT_TYPES.includes(contentType as (typeof PHOTO_ALLOWED_CONTENT_TYPES)[number])) {
      throw new BadRequestException({
        code: 'INVALID_FILE_TYPE',
        message: `contentType must be one of: ${PHOTO_ALLOWED_CONTENT_TYPES.join(', ')}`,
      });
    }

    if (!Number.isFinite(sizeBytes) || !Number.isInteger(sizeBytes) || sizeBytes <= 0) {
      throw new BadRequestException({
        code: 'FILE_TOO_LARGE',
        message: 'sizeBytes must be a positive integer',
      });
    }

    if (sizeBytes > PHOTO_MAX_SIZE_BYTES) {
      throw new BadRequestException({
        code: 'FILE_TOO_LARGE',
        message: `max file size is ${PHOTO_MAX_SIZE_BYTES} bytes`,
      });
    }

    return { filename, contentType, sizeBytes };
  }

  private assertFileCount(count: number) {
    if (count < PHOTO_FILES_MIN || count > PHOTO_FILES_MAX) {
      throw new BadRequestException({
        code: 'TOO_MANY_FILES',
        message: `files count must be between ${PHOTO_FILES_MIN} and ${PHOTO_FILES_MAX}`,
      });
    }
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

    if (parsed > PHOTO_TTL_MAX_SEC) {
      throw new BadRequestException({
        code: 'TTL_TOO_LARGE',
        message: `ttlSec must be <= ${PHOTO_TTL_MAX_SEC}`,
      });
    }

    return parsed;
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
