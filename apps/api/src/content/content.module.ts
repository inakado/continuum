import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { EventsLogModule } from '../events/events.module';
import { ObjectStorageModule } from '../infra/storage/object-storage.module';
import { LearningRecomputeModule } from '../learning/learning-recompute.module';
import { InternalLatexController } from './internal-latex.controller';
import { LatexCompileQueueService } from './latex-compile-queue.service';
import { ContentGraphService } from './content-graph.service';
import { ContentService } from './content.service';
import { ContentWriteService } from './content-write.service';
import { TeacherCoursesController } from './teacher-courses.controller';
import { TeacherLatexController } from './teacher-latex.controller';
import { TeacherSectionGraphController } from './teacher-section-graph.controller';
import { TeacherSectionsController } from './teacher-sections.controller';
import { TeacherUnitsController } from './teacher-units.controller';
import { TeacherTasksController } from './teacher-tasks.controller';
import { ContentCoverImagePolicyService } from './content-cover-image-policy.service';
import { TaskStatementImagePolicyService } from './task-statement-image-policy.service';
import { TaskRevisionPayloadService } from './task-revision-payload.service';
import { UnitPdfPolicyService } from './unit-pdf-policy.service';

@Module({
  imports: [AuthModule, EventsLogModule, ObjectStorageModule, LearningRecomputeModule],
  controllers: [
    InternalLatexController,
    TeacherCoursesController,
    TeacherLatexController,
    TeacherSectionGraphController,
    TeacherSectionsController,
    TeacherUnitsController,
    TeacherTasksController,
  ],
  providers: [
    ContentService,
    ContentGraphService,
    ContentWriteService,
    ContentCoverImagePolicyService,
    TaskRevisionPayloadService,
    UnitPdfPolicyService,
    TaskStatementImagePolicyService,
    LatexCompileQueueService,
  ],
  exports: [
    ContentService,
    ContentCoverImagePolicyService,
    UnitPdfPolicyService,
    TaskStatementImagePolicyService,
    LatexCompileQueueService,
  ],
})
export class ContentModule {}
