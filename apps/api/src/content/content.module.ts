import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { EventsLogModule } from '../events/events.module';
import { ContentService } from './content.service';
import { StudentCoursesController } from './student-courses.controller';
import { StudentSectionsController } from './student-sections.controller';
import { StudentUnitsController } from './student-units.controller';
import { TeacherCoursesController } from './teacher-courses.controller';
import { TeacherSectionGraphController } from './teacher-section-graph.controller';
import { TeacherSectionsController } from './teacher-sections.controller';
import { TeacherUnitsController } from './teacher-units.controller';
import { TeacherTasksController } from './teacher-tasks.controller';

@Module({
  imports: [AuthModule, EventsLogModule],
  controllers: [
    StudentCoursesController,
    StudentSectionsController,
    StudentUnitsController,
    TeacherCoursesController,
    TeacherSectionGraphController,
    TeacherSectionsController,
    TeacherUnitsController,
    TeacherTasksController,
  ],
  providers: [ContentService],
})
export class ContentModule {}
