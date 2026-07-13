import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AuthModule as BetterAuthNestModule } from '@thallesp/nestjs-better-auth';
import { AuthModule } from './auth/auth.module';
import { createBetterAuth } from './auth/better-auth.factory';
import { SessionAuthGuard } from './auth/guards/session-auth.guard';
import { ContentModule } from './content/content.module';
import { EventsLogModule } from './events/events.module';
import { LearningModule } from './learning/learning.module';
import { StudentsModule } from './students/students.module';
import { DebugController } from './debug.controller';
import { DebugLatexController } from './debug-latex.controller';
import { DebugStorageController } from './debug-storage.controller';
import { HealthController } from './health.controller';
import { ObjectStorageModule } from './infra/storage/object-storage.module';
import { PrismaModule } from './prisma/prisma.module';
import { PrismaService } from './prisma/prisma.service';
import { ReadyController } from './ready.controller';
import { ReadyService } from './ready.service';
import { shouldRegisterDebugControllers } from './runtime/environment';

export const resolveDebugControllers = () =>
  shouldRegisterDebugControllers()
    ? [DebugController, DebugStorageController, DebugLatexController]
    : [];

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
    ContentModule,
    EventsLogModule,
    StudentsModule,
    LearningModule,
    ObjectStorageModule,
  ],
  controllers: [
    HealthController,
    ReadyController,
    ...resolveDebugControllers(),
  ],
  providers: [
    ReadyService,
    {
      provide: APP_GUARD,
      useClass: SessionAuthGuard,
    },
  ],
})
export class AppModule {}
