import { afterEach, describe, expect, it } from "vitest";
import { resolveWorkerObjectStorageConfig } from "../src/storage/object-storage-config";

const restoreEnv = (snapshot: Record<string, string | undefined>) => {
  for (const key of Object.keys(process.env)) {
    if (!(key in snapshot)) {
      delete process.env[key];
    }
  }
  for (const [key, value] of Object.entries(snapshot)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
};

describe("resolveWorkerObjectStorageConfig", () => {
  const envSnapshot = { ...process.env } as Record<string, string | undefined>;

  afterEach(() => {
    restoreEnv(envSnapshot);
  });

  it("uses explicit S3 configuration when present", () => {
    process.env.S3_ENDPOINT = "https://s3.example.com";
    process.env.S3_REGION = "eu-west-1";
    process.env.S3_BUCKET = "worker-bucket";
    process.env.S3_ACCESS_KEY_ID = "worker-akid";
    process.env.S3_SECRET_ACCESS_KEY = "worker-secret";
    process.env.S3_FORCE_PATH_STYLE = "false";
    process.env.S3_PUBLIC_BASE_URL = "files.example.com/public";
    process.env.S3_CONNECTION_TIMEOUT_MS = "2200";
    process.env.S3_SOCKET_TIMEOUT_MS = "5200";
    process.env.NODE_ENV = "production";

    const config = resolveWorkerObjectStorageConfig();

    expect(config).toMatchObject({
      endpoint: "https://s3.example.com",
      region: "eu-west-1",
      bucket: "worker-bucket",
      accessKeyId: "worker-akid",
      secretAccessKey: "worker-secret",
      forcePathStyle: false,
      publicBaseUrl: "http://files.example.com/public",
      connectionTimeoutMs: 2200,
      socketTimeoutMs: 5200,
      isProduction: true,
    });
  });

  it("falls back to MinIO env values when S3 vars are absent", () => {
    delete process.env.S3_ENDPOINT;
    delete process.env.S3_REGION;
    delete process.env.S3_BUCKET;
    delete process.env.S3_ACCESS_KEY_ID;
    delete process.env.S3_SECRET_ACCESS_KEY;
    delete process.env.S3_PUBLIC_BASE_URL;
    delete process.env.S3_CONNECTION_TIMEOUT_MS;
    delete process.env.S3_SOCKET_TIMEOUT_MS;
    process.env.MINIO_ENDPOINT = "minio.local";
    process.env.MINIO_PORT = "9010";
    process.env.MINIO_ROOT_USER = "root-user";
    process.env.MINIO_ROOT_PASSWORD = "root-pass";
    process.env.S3_FORCE_PATH_STYLE = "true";
    process.env.NODE_ENV = "development";

    const config = resolveWorkerObjectStorageConfig();

    expect(config).toMatchObject({
      endpoint: "http://minio.local:9010",
      region: "us-east-1",
      bucket: "continuum",
      accessKeyId: "root-user",
      secretAccessKey: "root-pass",
      forcePathStyle: true,
      publicBaseUrl: null,
      connectionTimeoutMs: 2000,
      socketTimeoutMs: 5000,
      isProduction: false,
    });
  });
});
