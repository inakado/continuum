import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { IdentityAccessReadService } from './identity-access-read.service';
import { IdentityAccessWriteService } from './identity-access-write.service';
import { TeacherStudentsController } from './teacher-students.controller';
import { TeacherClassesController } from './teacher-classes.controller';
import { SchoolClassesReadService } from './school-classes-read.service';
import { SchoolClassesWriteService } from './school-classes-write.service';

import { StudentLifecycleService } from './student-lifecycle.service';

@Module({
  imports: [AuthModule],
  controllers: [TeacherStudentsController, TeacherClassesController],
  providers: [StudentLifecycleService, IdentityAccessReadService, IdentityAccessWriteService, SchoolClassesReadService, SchoolClassesWriteService],
})
export class IdentityAccessModule {}
