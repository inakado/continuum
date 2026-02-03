import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ContentService } from './content.service';
import { StudentCoursesController } from './student-courses.controller';
import { StudentSectionsController } from './student-sections.controller';
import { StudentUnitsController } from './student-units.controller';
import { TeacherCoursesController } from './teacher-courses.controller';
import { TeacherSectionsController } from './teacher-sections.controller';
import { TeacherUnitsController } from './teacher-units.controller';
import { TeacherTasksController } from './teacher-tasks.controller';

@Module({
  imports: [AuthModule],
  controllers: [
    StudentCoursesController,
    StudentSectionsController,
    StudentUnitsController,
    TeacherCoursesController,
    TeacherSectionsController,
    TeacherUnitsController,
    TeacherTasksController,
  ],
  providers: [ContentService],
})
export class ContentModule {}
