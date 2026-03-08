import { Controller, Get, Inject, Param, Req, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { type AuthRequest } from '../auth/auth.request';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { ContentService } from './content.service';
import { LearningService } from '../learning/learning.service';

@Controller('courses')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.student)
export class StudentCoursesController {
  constructor(
    @Inject(ContentService) private readonly contentService: ContentService,
    @Inject(LearningService) private readonly learningService: LearningService,
  ) {}

  @Get()
  list() {
    return this.contentService.listPublishedCourses();
  }

  @Get(':id')
  get(@Param('id') id: string, @Req() req: AuthRequest) {
    return this.learningService.getPublishedCourseForStudent(req.user.id, id);
  }
}
