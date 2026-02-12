import {
  BucketLocationConstraint,
  CreateBucketCommand,
  CreateBucketCommandInput,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  HeadObjectCommand,
  PutObjectCommandInput,
  S3Client,
  S3ServiceException,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Upload } from '@aws-sdk/lib-storage';
import { Inject, Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { NodeHttpHandler } from '@smithy/node-http-handler';
import { Readable } from 'node:stream';
import { OBJECT_STORAGE_CONFIG, ObjectStorageConfig } from './object-storage.config';

type PutObjectBody = Buffer | Uint8Array | NodeJS.ReadableStream | string;

export type PutObjectParams = {
  key: string;
  contentType: string;
  body: PutObjectBody;
  cacheControl?: string;
};

export type ObjectStreamResult = {
  stream: NodeJS.ReadableStream;
  contentType?: string;
  contentLength?: number;
  etag?: string;
  lastModified?: Date;
};

export type ObjectMetaResult = {
  exists: boolean;
  contentType?: string;
  contentLength?: number;
  etag?: string;
  lastModified?: Date;
};

type KnownStorageError = {
  name?: string;
  Code?: string;
  message?: string;
  $metadata?: {
    httpStatusCode?: number;
  };
};

@Injectable()
export class ObjectStorageService {
  private readonly s3: S3Client;
  private ensureBucketPromise: Promise<void> | null = null;

  constructor(
    @Inject(OBJECT_STORAGE_CONFIG)
    private readonly config: ObjectStorageConfig,
  ) {
    this.s3 = new S3Client({
      region: config.region,
      endpoint: config.endpoint,
      forcePathStyle: config.forcePathStyle,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
      requestHandler: new NodeHttpHandler({
        connectionTimeout: config.connectionTimeoutMs,
        socketTimeout: config.socketTimeoutMs,
      }),
      maxAttempts: 2,
    });
  }

  get bucketName(): string {
    return this.config.bucket;
  }

  async putObject(params: PutObjectParams): Promise<{ key: string; etag?: string }> {
    await this.ensureBucketExists();

    const upload = new Upload({
      client: this.s3,
      params: {
        Bucket: this.config.bucket,
        Key: params.key,
        Body: this.toSdkBody(params.body),
        ContentType: params.contentType,
        ...(params.cacheControl ? { CacheControl: params.cacheControl } : null),
      },
      queueSize: 1,
      leavePartsOnError: false,
    });

    try {
      const result = await upload.done();
      return { key: params.key, etag: result.ETag };
    } catch (error) {
      throw this.wrapStorageError(error, 'failed to upload object');
    }
  }

  async getObjectStream(key: string): Promise<ObjectStreamResult> {
    try {
      const output = await this.s3.send(
        new GetObjectCommand({
          Bucket: this.config.bucket,
          Key: key,
        }),
      );
      const stream = this.asNodeStream(output.Body);
      return {
        stream,
        contentType: output.ContentType,
        contentLength: output.ContentLength,
        etag: output.ETag,
        lastModified: output.LastModified,
      };
    } catch (error) {
      if (this.isNotFoundError(error)) {
        throw new NotFoundException('Object not found');
      }
      throw this.wrapStorageError(error, 'failed to download object');
    }
  }

  async getObjectMeta(key: string): Promise<ObjectMetaResult> {
    try {
      const output = await this.s3.send(
        new HeadObjectCommand({
          Bucket: this.config.bucket,
          Key: key,
        }),
      );
      return {
        exists: true,
        contentType: output.ContentType,
        contentLength: output.ContentLength,
        etag: output.ETag,
        lastModified: output.LastModified,
      };
    } catch (error) {
      if (this.isNotFoundError(error)) {
        return { exists: false };
      }
      throw this.wrapStorageError(error, 'failed to read object metadata');
    }
  }

  async deleteObject(key: string): Promise<void> {
    try {
      await this.s3.send(
        new DeleteObjectCommand({
          Bucket: this.config.bucket,
          Key: key,
        }),
      );
    } catch (error) {
      throw this.wrapStorageError(error, 'failed to delete object');
    }
  }

  async getPresignedGetUrl(key: string, ttlSec = 300): Promise<string> {
    try {
      const url = await getSignedUrl(
        this.s3,
        new GetObjectCommand({
          Bucket: this.config.bucket,
          Key: key,
        }),
        { expiresIn: ttlSec },
      );
      return this.rewritePresignedUrl(url);
    } catch (error) {
      throw this.wrapStorageError(error, 'failed to generate presigned URL');
    }
  }

  private async ensureBucketExists(): Promise<void> {
    if (!this.ensureBucketPromise) {
      this.ensureBucketPromise = this.ensureBucketExistsInner().catch((error) => {
        this.ensureBucketPromise = null;
        throw error;
      });
    }
    await this.ensureBucketPromise;
  }

  private async ensureBucketExistsInner(): Promise<void> {
    try {
      await this.s3.send(new HeadBucketCommand({ Bucket: this.config.bucket }));
      return;
    } catch (error) {
      if (!this.isBucketMissingError(error)) {
        throw this.wrapStorageError(error, 'failed to verify bucket');
      }
    }

    if (this.config.isProduction) {
      throw new InternalServerErrorException(
        `S3 bucket "${this.config.bucket}" does not exist in production`,
      );
    }

    try {
      const input: CreateBucketCommandInput = {
        Bucket: this.config.bucket,
      };
      if (this.config.region !== 'us-east-1') {
        input.CreateBucketConfiguration = {
          LocationConstraint: this.config.region as BucketLocationConstraint,
        };
      }

      await this.s3.send(new CreateBucketCommand(input));
    } catch (error) {
      throw this.wrapStorageError(error, `failed to create bucket "${this.config.bucket}"`);
    }
  }

  private toSdkBody(body: PutObjectBody): NonNullable<PutObjectCommandInput['Body']> {
    if (typeof body === 'string') return body;
    if (Buffer.isBuffer(body)) return body;
    if (body instanceof Uint8Array) return body;
    return body as NonNullable<PutObjectCommandInput['Body']>;
  }

  private asNodeStream(body: unknown): NodeJS.ReadableStream {
    if (body instanceof Readable) return body;

    if (body && typeof body === 'object') {
      const maybeBody = body as {
        pipe?: unknown;
        transformToWebStream?: () => ReadableStream<Uint8Array>;
      };

      if (typeof maybeBody.pipe === 'function') {
        return body as NodeJS.ReadableStream;
      }

      if (typeof maybeBody.transformToWebStream === 'function') {
        const webStream = maybeBody.transformToWebStream() as Parameters<typeof Readable.fromWeb>[0];
        return Readable.fromWeb(webStream);
      }
    }

    throw new InternalServerErrorException('Storage returned an unsupported stream body');
  }

  private rewritePresignedUrl(url: string): string {
    if (!this.config.publicBaseUrl) return url;

    const source = new URL(url);
    const target = new URL(this.config.publicBaseUrl);
    source.protocol = target.protocol;
    source.host = target.host;

    const basePath = target.pathname === '/' ? '' : target.pathname.replace(/\/+$/, '');
    if (basePath) {
      source.pathname = `${basePath}${source.pathname}`;
    }
    return source.toString();
  }

  private wrapStorageError(error: unknown, action: string): InternalServerErrorException {
    const details = this.extractStorageErrorDetails(error);
    return new InternalServerErrorException(`Object storage ${action}: ${details}`);
  }

  private extractStorageErrorDetails(error: unknown): string {
    if (error instanceof S3ServiceException) {
      return `${error.name}: ${error.message}`;
    }

    if (error instanceof Error) {
      return error.message;
    }

    return 'unknown storage error';
  }

  private isNotFoundError(error: unknown): boolean {
    const known = error as KnownStorageError | undefined;
    const code = known?.Code || known?.name;
    const status = known?.$metadata?.httpStatusCode;
    return code === 'NoSuchKey' || code === 'NotFound' || status === 404;
  }

  private isBucketMissingError(error: unknown): boolean {
    const known = error as KnownStorageError | undefined;
    const code = known?.Code || known?.name;
    const status = known?.$metadata?.httpStatusCode;
    return code === 'NoSuchBucket' || code === 'NotFound' || status === 404;
  }
}
