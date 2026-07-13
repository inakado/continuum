import { afterEach, describe, expect, it } from 'vitest';
import { resolveBetterAuthBaseUrl } from '../src/auth/better-auth.factory';

const originalUrl = process.env.BETTER_AUTH_URL;

afterEach(() => {
  if (originalUrl === undefined) delete process.env.BETTER_AUTH_URL;
  else process.env.BETTER_AUTH_URL = originalUrl;
});

describe('resolveBetterAuthBaseUrl', () => {
  it('accepts a public origin', () => {
    process.env.BETTER_AUTH_URL = 'https://vl-physics.ru/';
    expect(resolveBetterAuthBaseUrl()).toBe('https://vl-physics.ru');
  });

  it('rejects a reverse-proxy API path', () => {
    process.env.BETTER_AUTH_URL = 'https://vl-physics.ru/api';
    expect(() => resolveBetterAuthBaseUrl()).toThrow(
      'BETTER_AUTH_URL must contain only the public origin without a path.',
    );
  });
});
