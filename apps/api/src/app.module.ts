import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AuthModule as BetterAuthNestModule } from '@thallesp/nestjs-better-auth';
import { AuthModule } from './auth/auth.module';
import { createBetterAuth } from './auth/better-auth.factory';
import { SessionAuthGuard } from './auth/guards/session-auth.guard';
import { HealthController } from './health.controller';
import { IdentityAccessModule } from './identity-access/identity-access.module';
import { ObjectStorageModule } from './infra/storage/object-storage.module';
import { LibraryModule } from './library/library.module';
import { PrismaModule } from './prisma/prisma.module';
import { PrismaService } from './prisma/prisma.service';
import { ReadyController } from './ready.controller';
import { ReadyService } from './ready.service';

@Module({
  imports: [
    PrismaModule,
    BetterAuthNestModule.forRootAsync({
      imports: [PrismaModule],
      inject: [PrismaService],
      useFactory: (prisma: PrismaService) => ({
        auth: createBetterAuth(prisma),
        bodyParser: {
          json: { limit: '2mb' },
          urlencoded: { limit: '2mb', extended: true },
        },
      }),
      disableGlobalAuthGuard: true,
    }),
    AuthModule,
    IdentityAccessModule,
    LibraryModule,
    ObjectStorageModule,
  ],
  controllers: [HealthController, ReadyController],
  providers: [
    ReadyService,
    {
      provide: APP_GUARD,
      useClass: SessionAuthGuard,
    },
  ],
})
export class AppModule {}
