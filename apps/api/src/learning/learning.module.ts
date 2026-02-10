import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ContentModule } from '../content/content.module';
import { EventsLogModule } from '../events/events.module';
import { LearningService } from './learning.service';
import { StudentAttemptsController } from './student-attempts.controller';
import { StudentUnitsController } from './student-units.controller';
import { TeacherNotificationsController } from './teacher-notifications.controller';
import { TeacherTaskCreditController } from './teacher-task-credit.controller';

@Module({
  imports: [AuthModule, ContentModule, EventsLogModule],
  controllers: [
    StudentAttemptsController,
    StudentUnitsController,
    TeacherNotificationsController,
    TeacherTaskCreditController,
  ],
  providers: [LearningService],
})
export class LearningModule {}
