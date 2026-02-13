import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { ContentModule } from './content/content.module';
import { EventsLogModule } from './events/events.module';
import { LearningModule } from './learning/learning.module';
import { StudentsModule } from './students/students.module';
import { DebugController } from './debug.controller';
import { DebugLatexController } from './debug-latex.controller';
import { DebugStorageController } from './debug-storage.controller';
import { HealthController } from './health.controller';
import { LatexCompileModule } from './infra/latex/latex-compile.module';
import { ObjectStorageModule } from './infra/storage/object-storage.module';
import { PrismaModule } from './prisma/prisma.module';
import { ReadyController } from './ready.controller';
import { ReadyService } from './ready.service';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    ContentModule,
    EventsLogModule,
    StudentsModule,
    LearningModule,
    ObjectStorageModule,
    LatexCompileModule,
  ],
  controllers: [
    HealthController,
    ReadyController,
    DebugController,
    DebugStorageController,
    DebugLatexController,
  ],
  providers: [ReadyService],
})
export class AppModule {}
