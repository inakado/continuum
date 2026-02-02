import { Module } from '@nestjs/common';
import { DebugController } from './debug.controller';
import { HealthController } from './health.controller';
import { ReadyController } from './ready.controller';
import { ReadyService } from './ready.service';

@Module({
  controllers: [HealthController, ReadyController, DebugController],
  providers: [ReadyService],
})
export class AppModule {}
