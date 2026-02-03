import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { EventsLogService } from './events-log.service';
import { TeacherEventsController } from './teacher-events.controller';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [TeacherEventsController],
  providers: [EventsLogService],
  exports: [EventsLogService],
})
export class EventsLogModule {}
