import { describe, expect, it } from "vitest";
import {
  normalizePublicBaseUrl,
  parseBool,
  parsePositiveInt,
  resolveStorageConfigFromEnv,
  rewritePresignedUrlHost,
} from "../src/storage-core";

describe("storage-core helpers", () => {
  it("parseBool handles truthy and falsy values", () => {
    expect(parseBool("yes", false)).toBe(true);
    expect(parseBool("off", true)).toBe(false);
    expect(parseBool(undefined, true)).toBe(true);
    expect(parseBool("invalid", false)).toBe(false);
  });

  it("parsePositiveInt uses default for invalid values and floors valid numbers", () => {
    expect(parsePositiveInt(undefined, 7)).toBe(7);
    expect(parsePositiveInt("0", 7)).toBe(7);
    expect(parsePositiveInt("-4", 7)).toBe(7);
    expect(parsePositiveInt("12.9", 7)).toBe(12);
  });

  it("normalizePublicBaseUrl normalizes host and path", () => {
    expect(normalizePublicBaseUrl(undefined)).toBeNull();
    expect(normalizePublicBaseUrl("cdn.example.com/")).toBe("http://cdn.example.com");
    expect(normalizePublicBaseUrl("https://cdn.example.com/static/")).toBe(
      "https://cdn.example.com/static",
    );
  });

  it("rewrites presigned URL host and keeps query string", () => {
    const source =
      "http://minio:9000/bucket/file.pdf?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Signature=abc";
    const rewritten = rewritePresignedUrlHost(source, "https://files.example.com/assets");

    expect(rewritten).toContain("https://files.example.com:9000/assets/bucket/file.pdf");
    expect(rewritten).toContain("X-Amz-Signature=abc");
  });
});

describe("resolveStorageConfigFromEnv", () => {
  it("resolves S3 endpoint and production flag from env", () => {
    const config = resolveStorageConfigFromEnv({
      S3_ENDPOINT: "s3.example.com:9443/",
      S3_REGION: "eu-central-1",
      S3_BUCKET: "continuum-prod",
      S3_ACCESS_KEY_ID: "akid",
      S3_SECRET_ACCESS_KEY: "secret",
      S3_FORCE_PATH_STYLE: "false",
      S3_PUBLIC_BASE_URL: "https://files.example.com/cdn/",
      S3_CONNECTION_TIMEOUT_MS: "3001",
      S3_SOCKET_TIMEOUT_MS: "8001",
      APP_ENV: "production",
    });

    expect(config).toEqual({
      endpoint: "http://s3.example.com:9443",
      region: "eu-central-1",
      bucket: "continuum-prod",
      accessKeyId: "akid",
      secretAccessKey: "secret",
      forcePathStyle: false,
      publicBaseUrl: "https://files.example.com/cdn",
      connectionTimeoutMs: 3001,
      socketTimeoutMs: 8001,
      isProduction: true,
    });
  });

  it("falls back to MinIO defaults when S3 vars are absent", () => {
    const config = resolveStorageConfigFromEnv({});

    expect(config.endpoint).toBe("http://minio:9000");
    expect(config.bucket).toBe("continuum");
    expect(config.accessKeyId).toBe("minioadmin");
    expect(config.secretAccessKey).toBe("minioadmin");
    expect(config.isProduction).toBe(false);
  });
});
