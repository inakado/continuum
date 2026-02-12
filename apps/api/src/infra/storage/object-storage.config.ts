export const OBJECT_STORAGE_CONFIG = Symbol('OBJECT_STORAGE_CONFIG');

export type ObjectStorageConfig = {
  endpoint: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  forcePathStyle: boolean;
  publicBaseUrl: string | null;
  connectionTimeoutMs: number;
  socketTimeoutMs: number;
  isProduction: boolean;
};

const parseBool = (value: string | undefined, defaultValue: boolean): boolean => {
  if (value === undefined) return defaultValue;
  const normalized = value.trim().toLowerCase();
  if (['1', 'true', 'yes', 'y', 'on'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'n', 'off'].includes(normalized)) return false;
  return defaultValue;
};

const parsePositiveInt = (value: string | undefined, defaultValue: number): number => {
  if (!value) return defaultValue;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return defaultValue;
  return Math.floor(parsed);
};

const normalizeBaseUrl = (value: string | undefined): string | null => {
  if (!value || !value.trim()) return null;
  const trimmed = value.trim();
  const withScheme = trimmed.includes('://') ? trimmed : `http://${trimmed}`;
  const url = new URL(withScheme);
  const pathname = url.pathname.replace(/\/+$/, '');
  url.pathname = pathname || '/';
  return url.toString().replace(/\/$/, '');
};

const buildEndpointFromMinio = (): string | null => {
  const rawHost = process.env.MINIO_ENDPOINT?.trim();
  if (!rawHost) return null;

  if (rawHost.includes('://')) {
    const parsed = new URL(rawHost);
    if (!parsed.port && process.env.MINIO_PORT) {
      parsed.port = String(parsePositiveInt(process.env.MINIO_PORT, 9000));
    }
    return parsed.toString().replace(/\/$/, '');
  }

  if (rawHost.includes(':')) {
    return `http://${rawHost}`;
  }

  const port = parsePositiveInt(process.env.MINIO_PORT, 9000);
  return `http://${rawHost}:${port}`;
};

const resolveEndpoint = (): string => {
  const raw = process.env.S3_ENDPOINT?.trim();
  if (raw) {
    const withScheme = raw.includes('://') ? raw : `http://${raw}`;
    return withScheme.replace(/\/$/, '');
  }

  const fromMinio = buildEndpointFromMinio();
  if (fromMinio) return fromMinio;

  return 'http://minio:9000';
};

const resolveIsProduction = (): boolean => {
  const env = (process.env.APP_ENV || process.env.NODE_ENV || '').toLowerCase();
  return env === 'production';
};

export const resolveObjectStorageConfig = (): ObjectStorageConfig => ({
  endpoint: resolveEndpoint(),
  region: process.env.S3_REGION || 'us-east-1',
  bucket: process.env.S3_BUCKET || 'continuum',
  accessKeyId: process.env.S3_ACCESS_KEY_ID || process.env.MINIO_ROOT_USER || 'minioadmin',
  secretAccessKey:
    process.env.S3_SECRET_ACCESS_KEY || process.env.MINIO_ROOT_PASSWORD || 'minioadmin',
  forcePathStyle: parseBool(process.env.S3_FORCE_PATH_STYLE, true),
  publicBaseUrl: normalizeBaseUrl(process.env.S3_PUBLIC_BASE_URL),
  connectionTimeoutMs: parsePositiveInt(process.env.S3_CONNECTION_TIMEOUT_MS, 2_000),
  socketTimeoutMs: parsePositiveInt(process.env.S3_SOCKET_TIMEOUT_MS, 5_000),
  isProduction: resolveIsProduction(),
});
