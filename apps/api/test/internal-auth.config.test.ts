import { afterEach, describe, expect, it } from 'vitest';
import { resolveWorkerInternalToken } from '../src/auth/internal-auth.config';

const originalEnvironment = {
  APP_ENV: process.env.APP_ENV,
  NODE_ENV: process.env.NODE_ENV,
  WORKER_INTERNAL_TOKEN: process.env.WORKER_INTERNAL_TOKEN,
};

afterEach(() => {
  Object.assign(process.env, originalEnvironment);
});

describe('resolveWorkerInternalToken', () => {
  it('fails closed in production when the token is missing', () => {
    process.env.NODE_ENV = 'production';
    delete process.env.APP_ENV;
    delete process.env.WORKER_INTERNAL_TOKEN;

    expect(() => resolveWorkerInternalToken()).toThrow(
      'WORKER_INTERNAL_TOKEN must be set in production.',
    );
  });

  it('keeps the development-only fallback', () => {
    process.env.NODE_ENV = 'development';
    delete process.env.APP_ENV;
    delete process.env.WORKER_INTERNAL_TOKEN;

    expect(resolveWorkerInternalToken()).toBe('continuum-internal-dev');
  });
});
