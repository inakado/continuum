import 'reflect-metadata';
import { Controller, Get, INestApplication, UseGuards } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { Role } from '@prisma/client';
import { Test } from '@nestjs/testing';
import { AuthService as BetterAuthService } from '@thallesp/nestjs-better-auth';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AllowAnonymous } from '../../src/auth/decorators/allow-anonymous.decorator';
import { Roles } from '../../src/auth/decorators/roles.decorator';
import { RolesGuard } from '../../src/auth/guards/roles.guard';
import { SessionAuthGuard } from '../../src/auth/guards/session-auth.guard';
import { PrismaService } from '../../src/prisma/prisma.service';

@Controller('auth-matrix')
class AuthMatrixController {
  @Get('public')
  @AllowAnonymous()
  publicRoute() {
    return { ok: true };
  }

  @Get('teacher')
  @UseGuards(RolesGuard)
  @Roles(Role.teacher)
  teacherRoute() {
    return { ok: true };
  }

  @Get('admin')
  @UseGuards(RolesGuard)
  @Roles(Role.admin)
  adminRoute() {
    return { ok: true };
  }
}

describe('global auth route matrix', () => {
  let app: INestApplication;
  const deleteMany = vi.fn();

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [AuthMatrixController],
      providers: [
        RolesGuard,
        {
          provide: APP_GUARD,
          useClass: SessionAuthGuard,
        },
        {
          provide: BetterAuthService,
          useValue: {
            api: {
              getSession: vi.fn(({ headers }: { headers: Headers }) => {
                const role = headers.get('x-test-role');
                if (!role) return null;
                return {
                  session: { id: 'session-1' },
                  user: {
                    id: `${role}-1`,
                    username: `${role}1`,
                    role,
                    isActive: headers.get('x-test-inactive') !== 'true',
                  },
                };
              }),
            },
          },
        },
        {
          provide: PrismaService,
          useValue: { session: { deleteMany } },
        },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
    vi.clearAllMocks();
  });

  it('keeps only explicit public routes anonymous', async () => {
    await request(app.getHttpServer()).get('/auth-matrix/public').expect(200);
    await request(app.getHttpServer()).get('/auth-matrix/teacher').expect(401);
  });

  it('enforces teacher and admin roles', async () => {
    await request(app.getHttpServer())
      .get('/auth-matrix/teacher')
      .set('x-test-role', 'teacher')
      .expect(200);
    await request(app.getHttpServer())
      .get('/auth-matrix/admin')
      .set('x-test-role', 'teacher')
      .expect(403);
    await request(app.getHttpServer())
      .get('/auth-matrix/admin')
      .set('x-test-role', 'admin')
      .expect(200);
  });

  it('rejects inactive identities and deletes their sessions', async () => {
    await request(app.getHttpServer())
      .get('/auth-matrix/teacher')
      .set('x-test-role', 'teacher')
      .set('x-test-inactive', 'true')
      .expect(401);

    expect(deleteMany).toHaveBeenCalledWith({ where: { userId: 'teacher-1' } });
  });
});
