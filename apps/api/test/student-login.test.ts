import { describe, expect, it } from 'vitest';
import { studentLoginBase, reserveStudentLogin } from '../src/identity-access/student-login';

describe('readable student logins', () => {
  it.each([
    ['Ганшин', 'ganshin'], ['Жуков', 'zhukov'], ['Дуплищев', 'duplishchev'],
    ['Щербак', 'shcherbak'], ['Фёдоров', 'fedorov'], ['Соловьёв', 'solovev'],
    ['Майоров', 'mayorov'], ['Иванов-Петров', 'ivanov-petrov'],
    [' Smith ', 'smith'], ['García', 'garcia'], ['Ли', 's-li'], ['李', 'student'],
  ])('transliterates %s as %s', (name, expected) => {
    expect(studentLoginBase(name)).toBe(expected);
  });
  it('reserves suffixes without conflating namesakes or reusing existing accounts', () => {
    const used = new Set(['ivanov', 'ivanov2', 'ivanov4']);
    expect(reserveStudentLogin('Иванов', used)).toBe('ivanov3');
    expect(reserveStudentLogin('Иванов', used)).toBe('ivanov5');
    expect(reserveStudentLogin('Петров', used)).toBe('petrov');
    expect(reserveStudentLogin('Петров', used)).toBe('petrov2');
  });
  it('keeps long names within the existing login policy', () => {
    const base = studentLoginBase('Щ'.repeat(100));
    const login = reserveStudentLogin('Щ'.repeat(100), new Set([base]));
    expect(login).toMatch(/^[a-z0-9-]{3,64}$/);
    expect(login.endsWith('2')).toBe(true);
  });
});
