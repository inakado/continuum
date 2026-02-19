import { randomBytes } from 'node:crypto';
import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { Role } from '@prisma/client';
import {
  TASK_STATEMENT_IMAGE_ALLOWED_CONTENT_TYPES,
  TASK_STATEMENT_IMAGE_MAX_SIZE_BYTES,
  TASK_STATEMENT_IMAGE_TTL_MAX_SEC,
  TASK_STATEMENT_IMAGE_UPLOAD_TTL_DEFAULT_SEC,
  TASK_STATEMENT_IMAGE_VIEW_TTL_STUDENT_DEFAULT_SEC,
  TASK_STATEMENT_IMAGE_VIEW_TTL_TEACHER_DEFAULT_SEC,
} from './task-statement-image-policy.constants';

export type TaskStatementImageUploadFileInput = {
  filename: string;
  contentType: string;
  sizeBytes: number;
};

@Injectable()
export class TaskStatementImagePolicyService {
  readonly allowedContentTypes = TASK_STATEMENT_IMAGE_ALLOWED_CONTENT_TYPES;

  resolveUploadTtl(raw: unknown): number {
    return this.resolveTtl(raw, TASK_STATEMENT_IMAGE_UPLOAD_TTL_DEFAULT_SEC);
  }

  resolveViewTtl(role: Role, raw: unknown): number {
    const fallback =
      role === Role.teacher
        ? TASK_STATEMENT_IMAGE_VIEW_TTL_TEACHER_DEFAULT_SEC
        : TASK_STATEMENT_IMAGE_VIEW_TTL_STUDENT_DEFAULT_SEC;
    return this.resolveTtl(raw, fallback);
  }

  parseUploadFile(raw: unknown): TaskStatementImageUploadFileInput {
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
      !TASK_STATEMENT_IMAGE_ALLOWED_CONTENT_TYPES.includes(
        contentType as (typeof TASK_STATEMENT_IMAGE_ALLOWED_CONTENT_TYPES)[number],
      )
    ) {
      throw new BadRequestException({
        code: 'INVALID_FILE_TYPE',
        message: `contentType must be one of: ${TASK_STATEMENT_IMAGE_ALLOWED_CONTENT_TYPES.join(', ')}`,
      });
    }

    if (!Number.isFinite(sizeBytes) || !Number.isInteger(sizeBytes) || sizeBytes <= 0) {
      throw new BadRequestException({
        code: 'FILE_TOO_LARGE',
        message: 'sizeBytes must be a positive integer',
      });
    }

    if (sizeBytes > TASK_STATEMENT_IMAGE_MAX_SIZE_BYTES) {
      throw new BadRequestException({
        code: 'FILE_TOO_LARGE',
        message: `max file size is ${TASK_STATEMENT_IMAGE_MAX_SIZE_BYTES} bytes`,
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

  buildAssetPrefix(taskId: string, taskRevisionId: string): string {
    return `tasks/${taskId}/revisions/${taskRevisionId}/statement-image/`;
  }

  createAssetKey(taskId: string, taskRevisionId: string, contentType: string): string {
    const ext = this.extensionForContentType(contentType);
    const prefix = this.buildAssetPrefix(taskId, taskRevisionId);
    return `${prefix}${Date.now()}-${randomBytes(4).toString('hex')}.${ext}`;
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

  private assertAssetKeyPrefix(assetKey: string, prefix: string) {
    this.assertAssetKeyFormat(assetKey);
    if (!assetKey.startsWith(prefix)) {
      throw new ConflictException({
        code: 'INVALID_ASSET_KEY',
        message: 'assetKey does not belong to this task/revision',
      });
    }
  }

  private extensionForContentType(contentType: string): string {
    const normalized = this.normalizeContentType(contentType);
    if (normalized === 'image/jpeg') return 'jpg';
    if (normalized === 'image/png') return 'png';
    if (normalized === 'image/webp') return 'webp';

    throw new BadRequestException({
      code: 'INVALID_FILE_TYPE',
      message: `contentType must be one of: ${TASK_STATEMENT_IMAGE_ALLOWED_CONTENT_TYPES.join(', ')}`,
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

    if (parsed > TASK_STATEMENT_IMAGE_TTL_MAX_SEC) {
      throw new BadRequestException({
        code: 'TTL_TOO_LARGE',
        message: `ttlSec must be <= ${TASK_STATEMENT_IMAGE_TTL_MAX_SEC}`,
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
