import {
  BucketLocationConstraint,
  CreateBucketCommand,
  CreateBucketCommandInput,
  GetObjectCommand,
  HeadBucketCommand,
  PutObjectCommandInput,
  S3Client,
  S3ServiceException,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Upload } from '@aws-sdk/lib-storage';
import { NodeHttpHandler } from '@smithy/node-http-handler';
import { WorkerObjectStorageConfig } from './object-storage-config';

type PutObjectBody = Buffer | Uint8Array | NodeJS.ReadableStream | string;

type PutObjectParams = {
  key: string;
  contentType: string;
  body: PutObjectBody;
  cacheControl?: string;
};

type KnownStorageError = {
  name?: string;
  Code?: string;
  message?: string;
  $metadata?: {
    httpStatusCode?: number;
  };
};

export class WorkerObjectStorageService {
  private readonly s3: S3Client;
  private readonly presignS3: S3Client | null;
  private ensureBucketPromise: Promise<void> | null = null;

  constructor(private readonly config: WorkerObjectStorageConfig) {
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

  async getPresignedGetUrl(
    key: string,
    ttlSec: number,
    responseContentType?: string,
  ): Promise<string> {
    try {
      const presignClient = this.presignS3 || this.s3;
      return await getSignedUrl(
        presignClient,
        new GetObjectCommand({
          Bucket: this.config.bucket,
          Key: key,
          ...(responseContentType
            ? {
                ResponseContentType: responseContentType,
              }
            : null),
        }),
        { expiresIn: ttlSec },
      );
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
      throw new Error(`S3 bucket "${this.config.bucket}" does not exist in production`);
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

  private wrapStorageError(error: unknown, action: string): Error {
    const details = this.extractStorageErrorDetails(error);
    return new Error(`Object storage ${action}: ${details}`);
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

  private isBucketMissingError(error: unknown): boolean {
    const known = error as KnownStorageError | undefined;
    const code = known?.Code || known?.name;
    const status = known?.$metadata?.httpStatusCode;
    return code === 'NoSuchBucket' || code === 'NotFound' || status === 404;
  }
}
