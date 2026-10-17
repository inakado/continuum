import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AssessmentWorksReadService } from './assessment-works-read.service';
import { AssessmentWorksWriteService } from './assessment-works-write.service';
import { TeacherAssessmentWorksController } from './teacher-assessment-works.controller';

@Module({ imports: [PrismaModule], controllers: [TeacherAssessmentWorksController], providers: [AssessmentWorksReadService, AssessmentWorksWriteService], exports: [AssessmentWorksReadService, AssessmentWorksWriteService] })
export class AssessmentWorksModule {}
