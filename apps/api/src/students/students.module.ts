import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { EventsLogModule } from '../events/events.module';
import { StudentsService } from './students.service';
import { TeacherMeController } from './teacher-me.controller';
import { TeacherStudentsController } from './teacher-students.controller';
import { TeacherTeachersController } from './teacher-teachers.controller';

@Module({
  imports: [AuthModule, EventsLogModule],
  controllers: [TeacherStudentsController, TeacherTeachersController, TeacherMeController],
  providers: [StudentsService],
  exports: [StudentsService],
})
export class StudentsModule {}
