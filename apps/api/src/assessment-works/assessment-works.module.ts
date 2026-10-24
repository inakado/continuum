import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AssessmentWorksReadService } from './assessment-works-read.service';
import { AssessmentWorksWriteService } from './assessment-works-write.service';
import { TeacherAssessmentWorksController } from './teacher-assessment-works.controller';
import { AssessmentWorkLifecycleService } from './assessment-work-lifecycle.service';

@Module({ imports: [PrismaModule], controllers: [TeacherAssessmentWorksController], providers: [AssessmentWorksReadService, AssessmentWorksWriteService, AssessmentWorkLifecycleService], exports: [AssessmentWorksReadService, AssessmentWorksWriteService] })
export class AssessmentWorksModule {}
