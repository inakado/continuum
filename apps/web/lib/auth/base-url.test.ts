import { describe, expect, it } from 'vitest';
import { resolveAuthBaseUrl } from './base-url';

describe('resolveAuthBaseUrl', () => {
  it('appends the auth path to a production API path', () => {
    expect(resolveAuthBaseUrl('https://vl-physics.ru/api')).toBe(
      'https://vl-physics.ru/api/auth',
    );
  });

  it('appends the auth path to a local API origin', () => {
    expect(resolveAuthBaseUrl('http://localhost:3000')).toBe('http://localhost:3000/auth');
  });

  it('normalizes trailing slashes', () => {
    expect(resolveAuthBaseUrl('https://vl-physics.ru/api/')).toBe(
      'https://vl-physics.ru/api/auth',
    );
  });
});
