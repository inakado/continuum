import { afterEach, describe, expect, it } from 'vitest';
import { Role } from '@prisma/client';
import { ROLES_KEY } from '../src/auth/decorators/roles.decorator';
import { shouldRegisterDebugControllers } from '../src/runtime/environment';
import { TeacherDirectoryController } from '../src/students/teacher-directory.controller';
import { TeacherTeachersController } from '../src/students/teacher-teachers.controller';

const originalEnvironment = {
  APP_ENV: process.env.APP_ENV,
  NODE_ENV: process.env.NODE_ENV,
};

afterEach(() => {
  Object.assign(process.env, originalEnvironment);
});

describe('authentication boundaries', () => {
  it('reserves teacher account writes for admin and keeps directory read-only for teachers', () => {
    expect(Reflect.getMetadata(ROLES_KEY, TeacherTeachersController)).toEqual([Role.admin]);
    expect(Reflect.getMetadata(ROLES_KEY, TeacherDirectoryController)).toEqual([Role.teacher]);
  });

  it('does not register debug controllers in production', () => {
    process.env.NODE_ENV = 'production';
    delete process.env.APP_ENV;
    expect(shouldRegisterDebugControllers()).toBe(false);
  });

  it('keeps debug controllers available in development', () => {
    process.env.NODE_ENV = 'development';
    delete process.env.APP_ENV;
    expect(shouldRegisterDebugControllers()).toBe(true);
  });
});
