import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { ObjectStorageModule } from '../infra/storage/object-storage.module';
import { AssessmentWorksModule } from '../assessment-works/assessment-works.module';
import { AssignmentRosterService } from './assignment-roster.service';
import { AssignmentReadService } from './assignment-read.service';
import { AssignmentWriteService } from './assignment-write.service';
import { StudentAttemptReadService } from './student-attempt-read.service';
import { StudentAttemptWriteService } from './student-attempt-write.service';
import { TeacherAssignmentsController } from './teacher-assignments.controller';
import { StudentAttemptsController } from './student-attempts.controller';
import { SolutionsController } from './solutions.controller';
import { SolutionReadService } from './solution-read.service';
import { SolutionWriteService } from './solution-write.service';

@Module({ imports: [PrismaModule, ObjectStorageModule, AssessmentWorksModule],
  controllers: [TeacherAssignmentsController, StudentAttemptsController, SolutionsController],
  providers: [AssignmentRosterService, AssignmentReadService, AssignmentWriteService, StudentAttemptReadService, StudentAttemptWriteService, SolutionReadService, SolutionWriteService] })
export class AssessmentAssignmentsModule {}
