import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { IdentityProvisioningService } from '../auth/identity-provisioning.service';
import { EventsLogModule } from '../events/events.module';
import { StudentsService } from './students.service';
import { TeacherMeController } from './teacher-me.controller';
import { TeacherStudentsController } from './teacher-students.controller';
import { TeacherTeachersController } from './teacher-teachers.controller';
import { TeacherDirectoryController } from './teacher-directory.controller';
import { StudentMeController } from './student-me.controller';

@Module({
  imports: [AuthModule, EventsLogModule],
  controllers: [
    StudentMeController,
    TeacherStudentsController,
    TeacherDirectoryController,
    TeacherTeachersController,
    TeacherMeController,
  ],
  providers: [IdentityProvisioningService, StudentsService],
  exports: [StudentsService],
})
export class StudentsModule {}
