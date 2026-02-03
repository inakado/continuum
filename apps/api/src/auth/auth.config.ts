const isProd = () => {
  const env = process.env.NODE_ENV || process.env.APP_ENV || '';
  return env.toLowerCase() === 'production';
};

export const resolveJwtSecret = () => {
  const secret = process.env.JWT_SECRET;
  if (!secret && isProd()) {
    throw new Error('JWT_SECRET must be set in production.');
  }
  return secret || 'dev-insecure-change-me';
};

export const resolveJwtExpiresIn = () => process.env.JWT_EXPIRES_IN || '1h';

export const resolveAuthCookieName = () => process.env.AUTH_COOKIE_NAME || 'access_token';

const resolveAuthCookieMaxAgeMs = () => {
  const rawMs = process.env.AUTH_COOKIE_MAX_AGE_MS;
  if (rawMs) {
    const parsed = Number(rawMs);
    if (!Number.isNaN(parsed) && parsed > 0) return parsed;
  }
  const rawDays = process.env.AUTH_COOKIE_MAX_AGE_DAYS;
  const days = rawDays ? Number(rawDays) : 7;
  if (Number.isNaN(days) || days <= 0) return 7 * 24 * 60 * 60 * 1000;
  return days * 24 * 60 * 60 * 1000;
};

const resolveAuthCookieSecure = () => {
  if (process.env.AUTH_COOKIE_SECURE !== undefined) {
    return process.env.AUTH_COOKIE_SECURE === 'true';
  }
  return isProd();
};

export const resolveAuthCookieOptions = () => ({
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: resolveAuthCookieSecure(),
  path: '/',
  maxAge: resolveAuthCookieMaxAgeMs(),
});
