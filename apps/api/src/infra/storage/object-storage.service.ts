import {
  type BucketLocationConstraint,
  CreateBucketCommand,
  type CreateBucketCommandInput,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  HeadObjectCommand,
  type PutObjectCommandInput,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Upload } from '@aws-sdk/lib-storage';
import { Inject, Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { NodeHttpHandler } from '@smithy/node-http-handler';
import { Readable } from 'node:stream';
import { OBJECT_STORAGE_CONFIG, type ObjectStorageConfig } from './object-storage.config';

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
  private readonly presignS3: S3Client | null;
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

    this.presignS3 = config.publicBaseUrl
      ? new S3Client({
          region: config.region,
          endpoint: config.publicBaseUrl,
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
        })
      : null;
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
      throw this.wrapStorageError(error, 'не удалось загрузить объект');
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
        throw new NotFoundException('Файл не найден.');
      }
      throw this.wrapStorageError(error, 'не удалось скачать объект');
    }
  }

  async getObjectText(key: string): Promise<string> {
    const object = await this.getObjectStream(key);
    const chunks: Buffer[] = [];
    for await (const chunk of object.stream as AsyncIterable<Buffer | Uint8Array | string>) {
      chunks.push(
        typeof chunk === 'string' ? Buffer.from(chunk) : Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk),
      );
    }
    return Buffer.concat(chunks).toString('utf8');
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
      throw this.wrapStorageError(error, 'не удалось прочитать метаданные объекта');
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
      throw this.wrapStorageError(error, 'не удалось удалить объект');
    }
  }

  async getPresignedGetUrl(
    key: string,
    ttlSec = 300,
    responseContentType?: string,
  ): Promise<string> {
    return this.presignGetObject(key, ttlSec, responseContentType);
  }

  async presignGetObject(
    assetKey: string,
    ttlSec = 300,
    responseContentType?: string,
  ): Promise<string> {
    try {
      const presignClient = this.presignS3 || this.s3;
      const url = await getSignedUrl(
        presignClient,
        new GetObjectCommand({
          Bucket: this.config.bucket,
          Key: assetKey,
          ...(responseContentType
            ? {
                ResponseContentType: responseContentType,
              }
            : null),
        }),
        { expiresIn: ttlSec },
      );
      return url;
    } catch (error) {
      throw this.wrapStorageError(error, 'не удалось создать ссылку для скачивания');
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
        throw this.wrapStorageError(error, 'не удалось проверить хранилище');
      }
    }

    if (this.config.isProduction) {
      throw new InternalServerErrorException(
        `Хранилище S3 "${this.config.bucket}" не существует в рабочей среде`,
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
      throw this.wrapStorageError(error, `не удалось создать хранилище "${this.config.bucket}"`);
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

    throw new InternalServerErrorException('Хранилище вернуло неподдерживаемый поток.');
  }

  private wrapStorageError(error: unknown, action: string): InternalServerErrorException {
    void error;
    return new InternalServerErrorException(`Объектное хранилище: ${action}.`);
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
