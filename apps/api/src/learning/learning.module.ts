import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ContentModule } from '../content/content.module';
import { EventsLogModule } from '../events/events.module';
import { LearningAvailabilityService } from './learning-availability.service';
import { LearningService } from './learning.service';
import { StudentAttemptsController } from './student-attempts.controller';
import { StudentSectionGraphController } from './student-section-graph.controller';
import { StudentUnitsController } from './student-units.controller';
import { TeacherNotificationsController } from './teacher-notifications.controller';
import { TeacherStudentUnitPreviewController } from './teacher-student-unit-preview.controller';
import { TeacherTaskCreditController } from './teacher-task-credit.controller';

@Module({
  imports: [AuthModule, ContentModule, EventsLogModule],
  controllers: [
    StudentAttemptsController,
    StudentSectionGraphController,
    StudentUnitsController,
    TeacherNotificationsController,
    TeacherStudentUnitPreviewController,
    TeacherTaskCreditController,
  ],
  providers: [LearningService, LearningAvailabilityService],
})
export class LearningModule {}
