import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ContentModule } from '../content/content.module';
import { EventsLogModule } from '../events/events.module';
import { ObjectStorageModule } from '../infra/storage/object-storage.module';
import { StudentsModule } from '../students/students.module';
import { LearningAvailabilityService } from './learning-availability.service';
import { LearningService } from './learning.service';
import { PhotoTaskPolicyService } from './photo-task-policy.service';
import { PhotoTaskService } from './photo-task.service';
import { StudentAttemptsController } from './student-attempts.controller';
import { StudentPhotoTasksController } from './student-photo-tasks.controller';
import { StudentSectionGraphController } from './student-section-graph.controller';
import { StudentTaskSolutionsController } from './student-task-solutions.controller';
import { StudentUnitsController } from './student-units.controller';
import { TeacherPhotoSubmissionsController } from './teacher-photo-submissions.controller';
import { TeacherNotificationsController } from './teacher-notifications.controller';
import { TeacherStudentUnitPreviewController } from './teacher-student-unit-preview.controller';
import { TeacherTaskCreditController } from './teacher-task-credit.controller';

@Module({
  imports: [AuthModule, ContentModule, EventsLogModule, ObjectStorageModule, StudentsModule],
  controllers: [
    StudentAttemptsController,
    StudentPhotoTasksController,
    StudentSectionGraphController,
    StudentTaskSolutionsController,
    StudentUnitsController,
    TeacherPhotoSubmissionsController,
    TeacherNotificationsController,
    TeacherStudentUnitPreviewController,
    TeacherTaskCreditController,
  ],
  providers: [
    LearningService,
    LearningAvailabilityService,
    PhotoTaskService,
    PhotoTaskPolicyService,
  ],
})
export class LearningModule {}
