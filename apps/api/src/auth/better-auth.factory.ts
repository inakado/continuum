import argon2 from 'argon2';
import { betterAuth } from 'better-auth';
import { APIError, createAuthMiddleware } from 'better-auth/api';
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

export const resolveBetterAuthBaseUrl = () => {
  const configured = process.env.BETTER_AUTH_URL?.trim();
  if (configured) {
    const url = new URL(configured);
    if (url.pathname !== '/' || url.search || url.hash) {
      throw new Error('BETTER_AUTH_URL must contain only the public origin without a path.');
    }
    return url.origin;
  }
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
    baseURL: resolveBetterAuthBaseUrl(),
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
    hooks: {
      before: createAuthMiddleware(async (context) => {
        if (context.path !== '/sign-in/username') return;
        const username = context.body?.username;
        const password = context.body?.password;
        if (typeof username !== 'string' || typeof password !== 'string') return;

        let login: string;
        try {
          login = normalizeLogin(username);
        } catch {
          return;
        }

        const user = await prisma.user.findUnique({
          where: { login },
          select: {
            isActive: true,
            accounts: {
              where: { providerId: 'credential' },
              select: { password: true },
              take: 1,
            },
          },
        });
        if (user && !user.isActive) {
          const passwordHash = user.accounts[0]?.password;
          if (passwordHash) await argon2.verify(passwordHash, password).catch(() => false);
          throw new APIError('UNAUTHORIZED', {
            code: 'INVALID_USERNAME_OR_PASSWORD',
            message: 'Invalid username or password.',
          });
        }
      }),
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
      customRules: {
        '/sign-in/username': { window: 60, max: 5 },
      },
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
