import { describe, expect, it } from 'vitest';
import { Role } from '@prisma/client';
import { ALLOW_ANONYMOUS_KEY } from '../src/auth/decorators/allow-anonymous.decorator';
import { ROLES_KEY } from '../src/auth/decorators/roles.decorator';
import { AuthMeController } from '../src/auth/auth-me.controller';
import { HealthController } from '../src/health.controller';
import { TeacherStudentsController } from '../src/identity-access/teacher-students.controller';
import { StudentLibraryController } from '../src/library/student-library.controller';
import { TeacherLibraryController } from '../src/library/teacher-library.controller';
import { ReadyController } from '../src/ready.controller';

describe('authentication boundaries', () => {
  it('keeps health and readiness outside session auth', () => {
    expect(Reflect.getMetadata(ALLOW_ANONYMOUS_KEY, HealthController)).toBe(true);
    expect(Reflect.getMetadata(ALLOW_ANONYMOUS_KEY, ReadyController)).toBe(true);
  });

  it('keeps the current-session endpoint protected by default', () => {
    expect(Reflect.getMetadata(ALLOW_ANONYMOUS_KEY, AuthMeController)).not.toBe(true);
  });

  it('pins each library surface to its own role', () => {
    expect(Reflect.getMetadata(ROLES_KEY, StudentLibraryController)).toEqual([Role.student]);
    expect(Reflect.getMetadata(ROLES_KEY, TeacherLibraryController)).toEqual([Role.teacher]);
    expect(Reflect.getMetadata(ROLES_KEY, TeacherStudentsController)).toEqual([Role.teacher]);
  });
});
