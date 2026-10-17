import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { ObjectStorageModule } from '../infra/storage/object-storage.module';
import { AssessmentBankReadService } from './assessment-bank-read.service';
import { AssessmentBankWriteService } from './assessment-bank-write.service';
import { TeacherAssessmentBankController } from './teacher-assessment-bank.controller';

@Module({ imports: [PrismaModule, ObjectStorageModule], controllers: [TeacherAssessmentBankController], providers: [AssessmentBankReadService, AssessmentBankWriteService] })
export class AssessmentBankModule {}
