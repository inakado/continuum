import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { ContentService } from './content.service';

@Controller('courses')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.student)
export class StudentCoursesController {
  constructor(private readonly contentService: ContentService) {}

  @Get()
  list() {
    return this.contentService.listPublishedCourses();
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.contentService.getPublishedCourse(id);
  }
}
