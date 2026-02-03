import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { ContentModule } from './content/content.module';
import { EventsLogModule } from './events/events.module';
import { DebugController } from './debug.controller';
import { HealthController } from './health.controller';
import { PrismaModule } from './prisma/prisma.module';
import { ReadyController } from './ready.controller';
import { ReadyService } from './ready.service';

@Module({
  imports: [PrismaModule, AuthModule, ContentModule, EventsLogModule],
  controllers: [HealthController, ReadyController, DebugController],
  providers: [ReadyService],
})
export class AppModule {}
