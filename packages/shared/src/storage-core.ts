export type StorageCoreConfig = {
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

export const parseBool = (value: string | undefined, defaultValue: boolean): boolean => {
  if (value === undefined) return defaultValue;
  const normalized = value.trim().toLowerCase();
  if (['1', 'true', 'yes', 'y', 'on'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'n', 'off'].includes(normalized)) return false;
  return defaultValue;
};

export const parsePositiveInt = (value: string | undefined, defaultValue: number): number => {
  if (!value) return defaultValue;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return defaultValue;
  return Math.floor(parsed);
};

export const normalizePublicBaseUrl = (value: string | undefined): string | null => {
  if (!value || !value.trim()) return null;
  const trimmed = value.trim();
  const withScheme = trimmed.includes('://') ? trimmed : `http://${trimmed}`;
  const url = new URL(withScheme);
  const pathname = url.pathname.replace(/\/+$/, '');
  url.pathname = pathname || '/';
  return url.toString().replace(/\/$/, '');
};

const buildEndpointFromMinio = (env: Record<string, string | undefined>): string | null => {
  const rawHost = env.MINIO_ENDPOINT?.trim();
  if (!rawHost) return null;

  if (rawHost.includes('://')) {
    const parsed = new URL(rawHost);
    if (!parsed.port && env.MINIO_PORT) {
      parsed.port = String(parsePositiveInt(env.MINIO_PORT, 9000));
    }
    return parsed.toString().replace(/\/$/, '');
  }

  if (rawHost.includes(':')) {
    return `http://${rawHost}`;
  }

  const port = parsePositiveInt(env.MINIO_PORT, 9000);
  return `http://${rawHost}:${port}`;
};

const resolveEndpoint = (env: Record<string, string | undefined>): string => {
  const raw = env.S3_ENDPOINT?.trim();
  if (raw) {
    const withScheme = raw.includes('://') ? raw : `http://${raw}`;
    return withScheme.replace(/\/$/, '');
  }

  const fromMinio = buildEndpointFromMinio(env);
  if (fromMinio) return fromMinio;

  return 'http://minio:9000';
};

const resolveIsProduction = (env: Record<string, string | undefined>): boolean => {
  const raw = env.APP_ENV || env.NODE_ENV || '';
  return raw.trim().toLowerCase() === 'production';
};

export const resolveStorageConfigFromEnv = (
  env: Record<string, string | undefined>,
): StorageCoreConfig => ({
  endpoint: resolveEndpoint(env),
  region: env.S3_REGION || 'us-east-1',
  bucket: env.S3_BUCKET || 'continuum',
  accessKeyId: env.S3_ACCESS_KEY_ID || env.MINIO_ROOT_USER || 'minioadmin',
  secretAccessKey: env.S3_SECRET_ACCESS_KEY || env.MINIO_ROOT_PASSWORD || 'minioadmin',
  forcePathStyle: parseBool(env.S3_FORCE_PATH_STYLE, true),
  publicBaseUrl: normalizePublicBaseUrl(env.S3_PUBLIC_BASE_URL),
  connectionTimeoutMs: parsePositiveInt(env.S3_CONNECTION_TIMEOUT_MS, 2_000),
  socketTimeoutMs: parsePositiveInt(env.S3_SOCKET_TIMEOUT_MS, 5_000),
  isProduction: resolveIsProduction(env),
});

export const rewritePresignedUrlHost = (url: string, publicBaseUrl?: string | null): string => {
  const normalizedBase = normalizePublicBaseUrl(publicBaseUrl || undefined);
  if (!normalizedBase) return url;

  try {
    const source = new URL(url);
    const base = new URL(normalizedBase);
    source.protocol = base.protocol;
    source.host = base.host;

    const basePath = base.pathname.replace(/\/$/, '');
    if (basePath && basePath !== '/') {
      const sourcePath = source.pathname.startsWith('/') ? source.pathname : `/${source.pathname}`;
      source.pathname = `${basePath}${sourcePath}`;
    }
    return source.toString();
  } catch {
    return url;
  }
};
