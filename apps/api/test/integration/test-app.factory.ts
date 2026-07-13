import 'reflect-metadata';
import type { INestApplication, Type } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { Role } from '@prisma/client';
import { Test } from '@nestjs/testing';
import type { AuthUser } from '../../src/auth/auth.types';
import { RolesGuard } from '../../src/auth/guards/roles.guard';

type IntegrationAppOptions = {
  controllers: Array<Type<unknown>>;
  providers: any[];
  user?: Partial<AuthUser>;
  constructorParams?: Array<{
    target: Type<unknown>;
    deps: any[];
  }>;
};

export async function createIntegrationApp(options: IntegrationAppOptions): Promise<INestApplication> {
  const user: AuthUser = {
    id: options.user?.id ?? 'integration-user',
    login: options.user?.login ?? 'integration-login',
    role: options.user?.role ?? Role.teacher,
  };

  for (const params of options.constructorParams ?? []) {
    Reflect.defineMetadata('design:paramtypes', params.deps, params.target);
  }

  const testingModuleBuilder = Test.createTestingModule({
    controllers: options.controllers,
    providers: [
      ...options.providers,
      {
        provide: APP_GUARD,
        useValue: {
          canActivate(context: any) {
            context.switchToHttp().getRequest().user = user;
            return true;
          },
        },
      },
    ],
  });

  testingModuleBuilder.overrideGuard(RolesGuard).useValue({
    canActivate() {
      return true;
    },
  });

  const moduleRef = await testingModuleBuilder.compile();

  const app = moduleRef.createNestApplication();
  await app.init();
  return app;
}
