import { describe, expect, it } from 'vitest';
import { buildIdentityName, buildTechnicalEmail, normalizeLogin } from '../src/auth/identity-policy';

describe('identity policy', () => {
  it('canonicalizes login and builds a reserved technical email', () => {
    expect(normalizeLogin('  Teacher.One  ')).toBe('teacher.one');
    expect(buildTechnicalEmail('Teacher.One')).toBe('teacher.one@users.continuum.invalid');
  });

  it('rejects unsupported login characters', () => {
    expect(() => normalizeLogin('Иван')).toThrow();
    expect(() => normalizeLogin('a b')).toThrow();
  });

  it('uses profile names with a login fallback', () => {
    expect(buildIdentityName({ firstName: 'Анна', lastName: 'Петрова', login: 'teacher1' })).toBe(
      'Анна Петрова',
    );
    expect(buildIdentityName({ login: 'Teacher1' })).toBe('teacher1');
  });
});
