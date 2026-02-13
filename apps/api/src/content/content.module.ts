import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { EventsLogModule } from '../events/events.module';
import { ObjectStorageModule } from '../infra/storage/object-storage.module';
import { InternalLatexController } from './internal-latex.controller';
import { LatexCompileQueueService } from './latex-compile-queue.service';
import { ContentService } from './content.service';
import { StudentCoursesController } from './student-courses.controller';
import { StudentSectionsController } from './student-sections.controller';
import { TeacherCoursesController } from './teacher-courses.controller';
import { TeacherLatexController } from './teacher-latex.controller';
import { TeacherSectionGraphController } from './teacher-section-graph.controller';
import { TeacherSectionsController } from './teacher-sections.controller';
import { TeacherUnitsController } from './teacher-units.controller';
import { TeacherTasksController } from './teacher-tasks.controller';
import { UnitPdfPolicyService } from './unit-pdf-policy.service';

@Module({
  imports: [AuthModule, EventsLogModule, ObjectStorageModule],
  controllers: [
    InternalLatexController,
    StudentCoursesController,
    StudentSectionsController,
    TeacherCoursesController,
    TeacherLatexController,
    TeacherSectionGraphController,
    TeacherSectionsController,
    TeacherUnitsController,
    TeacherTasksController,
  ],
  providers: [ContentService, UnitPdfPolicyService, LatexCompileQueueService],
  exports: [ContentService, UnitPdfPolicyService],
})
export class ContentModule {}
