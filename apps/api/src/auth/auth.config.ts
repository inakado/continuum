const isProd = () => {
  const env = process.env.NODE_ENV || process.env.APP_ENV || '';
  return env.toLowerCase() === 'production';
};

const parsePositiveInt = (raw?: string) => {
  if (!raw) return null;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return Math.floor(parsed);
};

const parseJwtDurationToMs = (value: number | string) => {
  if (typeof value === 'number') {
    if (!Number.isFinite(value) || value <= 0) return null;
    return Math.floor(value * 1000);
  }

  if (/^\d+$/.test(value)) {
    const asSeconds = Number(value);
    if (!Number.isFinite(asSeconds) || asSeconds <= 0) return null;
    return Math.floor(asSeconds * 1000);
  }

  const match = value.trim().match(/^(\d+)\s*([smhd])$/i);
  if (!match) return null;

  const amount = Number(match[1]);
  if (!Number.isFinite(amount) || amount <= 0) return null;

  const unit = match[2].toLowerCase();
  if (unit === 's') return amount * 1000;
  if (unit === 'm') return amount * 60 * 1000;
  if (unit === 'h') return amount * 60 * 60 * 1000;
  if (unit === 'd') return amount * 24 * 60 * 60 * 1000;
  return null;
};

const resolveBoolean = (primary?: string, fallback?: string) => {
  if (primary !== undefined) return primary === 'true';
  if (fallback !== undefined) return fallback === 'true';
  return isProd();
};

export const resolveJwtSecret = () => {
  const secret = process.env.JWT_SECRET;
  if (!secret && isProd()) {
    throw new Error('JWT_SECRET must be set in production.');
  }
  return secret || 'dev-insecure-change-me';
};

export const resolveJwtAccessExpiresIn = (): number | string => {
  const raw = process.env.JWT_ACCESS_EXPIRES_IN || process.env.JWT_EXPIRES_IN || '15m';
  if (/^\d+$/.test(raw)) {
    const asNumber = Number(raw);
    if (Number.isFinite(asNumber) && asNumber > 0) {
      return asNumber;
    }
  }
  return raw;
};

export const resolveJwtExpiresIn = resolveJwtAccessExpiresIn;

export const resolveAuthCookieName = () => process.env.AUTH_COOKIE_NAME || 'access_token';

export const resolveRefreshCookieName = () =>
  process.env.AUTH_REFRESH_COOKIE_NAME || 'refresh_token';

export const resolveRefreshExpiresInDays = () => {
  const parsed = parsePositiveInt(process.env.AUTH_REFRESH_EXPIRES_IN_DAYS);
  if (parsed) return parsed;
  return 14;
};

const resolveAccessCookieMaxAgeMs = () => {
  const rawMs = process.env.AUTH_ACCESS_COOKIE_MAX_AGE_MS || process.env.AUTH_COOKIE_MAX_AGE_MS;
  if (rawMs) {
    const parsed = Number(rawMs);
    if (!Number.isNaN(parsed) && parsed > 0) return parsed;
  }
  const fromJwt = parseJwtDurationToMs(resolveJwtAccessExpiresIn());
  if (fromJwt && fromJwt > 0) return fromJwt;
  return 15 * 60 * 1000;
};

const resolveRefreshCookieMaxAgeMs = () => resolveRefreshExpiresInDays() * 24 * 60 * 60 * 1000;

const resolveAccessCookieSecure = () => resolveBoolean(process.env.AUTH_COOKIE_SECURE);
const resolveRefreshCookieSecure = () =>
  resolveBoolean(process.env.AUTH_REFRESH_COOKIE_SECURE, process.env.AUTH_COOKIE_SECURE);

const resolveRefreshCookiePath = () => process.env.AUTH_REFRESH_COOKIE_PATH || '/auth';

export const resolveAuthCookieOptions = () => ({
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: resolveAccessCookieSecure(),
  path: '/',
  maxAge: resolveAccessCookieMaxAgeMs(),
});

export const resolveRefreshCookieOptions = () => ({
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: resolveRefreshCookieSecure(),
  path: resolveRefreshCookiePath(),
  maxAge: resolveRefreshCookieMaxAgeMs(),
});
