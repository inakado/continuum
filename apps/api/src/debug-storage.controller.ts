import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { Response } from 'express';
import { Roles } from './auth/decorators/roles.decorator';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { RolesGuard } from './auth/guards/roles.guard';
import { ObjectStorageService } from './infra/storage/object-storage.service';

type DebugPutRequest = {
  key?: unknown;
  contentType?: unknown;
  body?: unknown;
};

@Controller('teacher/debug/storage')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.teacher)
export class DebugStorageController {
  constructor(private readonly objectStorageService: ObjectStorageService) {}

  @Post('put')
  @HttpCode(200)
  async put(@Body() payload: DebugPutRequest) {
    const key = this.requireNonEmptyString(payload.key, 'key');
    const contentType = this.optionalString(payload.contentType) || 'application/octet-stream';
    const body = this.requireString(payload.body, 'body');

    const result = await this.objectStorageService.putObject({
      key,
      contentType,
      body,
      cacheControl: 'no-store',
    });

    return {
      ok: true,
      key: result.key,
      bucket: this.objectStorageService.bucketName,
      ...(result.etag ? { etag: result.etag } : null),
    };
  }

  @Get('get')
  async get(@Query('key') keyRaw: string | undefined, @Res() res: Response) {
    const key = this.requireNonEmptyString(keyRaw, 'key');
    const object = await this.objectStorageService.getObjectStream(key);

    res.setHeader('Content-Type', object.contentType || 'application/octet-stream');
    res.setHeader('Cache-Control', 'no-store');
    if (typeof object.contentLength === 'number') {
      res.setHeader('Content-Length', String(object.contentLength));
    }
    if (object.etag) {
      res.setHeader('ETag', object.etag);
    }

    object.stream.on('error', (error: Error) => {
      if (res.headersSent) {
        res.destroy(error);
        return;
      }
      res.status(500).json({ message: 'Failed to stream object', error: error.message });
    });

    object.stream.pipe(res);
  }

  @Get('presign')
  async presign(
    @Query('key') keyRaw: string | undefined,
    @Query('ttlSec') ttlRaw: string | undefined,
  ) {
    const key = this.requireNonEmptyString(keyRaw, 'key');
    const ttlSec = this.parseTtl(ttlRaw);
    const url = await this.objectStorageService.getPresignedGetUrl(key, ttlSec);

    return {
      ok: true,
      key,
      expiresInSec: ttlSec,
      url,
    };
  }

  private requireNonEmptyString(value: unknown, fieldName: string): string {
    if (typeof value !== 'string') {
      throw new BadRequestException(`${fieldName} must be a non-empty string`);
    }
    const trimmed = value.trim();
    if (!trimmed) {
      throw new BadRequestException(`${fieldName} must be a non-empty string`);
    }
    return trimmed;
  }

  private requireString(value: unknown, fieldName: string): string {
    if (typeof value !== 'string') {
      throw new BadRequestException(`${fieldName} must be a string`);
    }
    return value;
  }

  private optionalString(value: unknown): string | undefined {
    if (value === undefined || value === null) return undefined;
    if (typeof value !== 'string') {
      throw new BadRequestException('contentType must be a string');
    }
    const trimmed = value.trim();
    return trimmed || undefined;
  }

  private parseTtl(raw: string | undefined): number {
    if (raw === undefined || raw === null || raw === '') return 300;

    const parsed = Number(raw);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      throw new BadRequestException('ttlSec must be a positive integer');
    }

    const ttl = Math.floor(parsed);
    if (ttl > 86_400) {
      throw new BadRequestException('ttlSec must be <= 86400');
    }
    return ttl;
  }
}
