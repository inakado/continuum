import argon2 from 'argon2';
import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { username } from 'better-auth/plugins/username';
import type { PrismaService } from '../prisma/prisma.service';
import { isProductionEnvironment } from '../runtime/environment';
import { normalizeLogin } from './identity-policy';

const SESSION_TTL_SECONDS = 14 * 24 * 60 * 60;
const LOGIN_PATTERN = /^[a-z0-9._-]+$/;

const resolveSecret = () => {
  const secret = process.env.BETTER_AUTH_SECRET?.trim();
  if (secret) return secret;
  if (isProductionEnvironment()) {
    throw new Error('BETTER_AUTH_SECRET must be set in production.');
  }
  return 'continuum-development-secret-change-me';
};

const resolveBaseUrl = () => {
  const configured = process.env.BETTER_AUTH_URL?.trim();
  if (configured) return configured.replace(/\/+$/, '');
  return `http://localhost:${Number(process.env.API_PORT || 3000)}`;
};

const resolveTrustedOrigins = () => {
  const fallback = `http://localhost:${Number(process.env.WEB_PORT || 3001)}`;
  return (process.env.CORS_ORIGIN || process.env.WEB_ORIGIN || fallback)
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
};

export const createBetterAuth = (prisma: PrismaService) =>
  betterAuth({
    appName: 'Континуум',
    secret: resolveSecret(),
    baseURL: resolveBaseUrl(),
    basePath: '/auth',
    trustedOrigins: resolveTrustedOrigins(),
    database: prismaAdapter(prisma, { provider: 'postgresql' }),
    emailAndPassword: {
      enabled: true,
      disableSignUp: true,
      requireEmailVerification: false,
      minPasswordLength: 8,
      maxPasswordLength: 128,
      password: {
        hash: (password) => argon2.hash(password),
        verify: ({ hash, password }) => argon2.verify(hash, password),
      },
    },
    session: {
      expiresIn: SESSION_TTL_SECONDS,
      disableSessionRefresh: true,
      cookieCache: { enabled: false },
    },
    user: {
      changeEmail: { enabled: false },
      deleteUser: { enabled: false },
      additionalFields: {
        role: {
          type: ['admin', 'teacher', 'student'],
          required: true,
          input: false,
        },
        isActive: {
          type: 'boolean',
          required: true,
          defaultValue: true,
          input: false,
        },
      },
    },
    disabledPaths: [
      '/sign-up/email',
      '/sign-in/email',
      '/is-username-available',
      '/change-email',
      '/request-password-reset',
      '/reset-password',
      '/update-user',
      '/delete-user',
    ],
    rateLimit: {
      enabled: true,
      window: 60,
      max: 100,
    },
    advanced: {
      useSecureCookies: isProductionEnvironment(),
      database: { generateId: 'uuid' },
      ipAddress: { ipAddressHeaders: ['x-real-ip'] },
    },
    plugins: [
      username({
        minUsernameLength: 3,
        maxUsernameLength: 64,
        usernameNormalization: normalizeLogin,
        displayUsernameNormalization: normalizeLogin,
        usernameValidator: (value) => LOGIN_PATTERN.test(value),
        displayUsernameValidator: (value) => LOGIN_PATTERN.test(value),
        validationOrder: { username: 'pre-normalization', displayUsername: 'pre-normalization' },
        schema: {
          user: {
            fields: {
              username: 'login',
              displayUsername: 'displayLogin',
            },
          },
        },
      }),
    ],
  });

export type ContinuumBetterAuth = ReturnType<typeof createBetterAuth>;
