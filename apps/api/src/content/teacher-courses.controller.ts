import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { ContentService } from './content.service';
import { CreateCourseDto, UpdateCourseDto } from './dto/course.dto';

@Controller('teacher/courses')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.teacher)
export class TeacherCoursesController {
  constructor(private readonly contentService: ContentService) {}

  @Get()
  list() {
    return this.contentService.listCourses();
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.contentService.getCourse(id);
  }

  @Post()
  create(@Body() dto: CreateCourseDto) {
    return this.contentService.createCourse(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateCourseDto) {
    return this.contentService.updateCourse(id, dto);
  }

  @Post(':id/publish')
  @HttpCode(200)
  publish(@Param('id') id: string) {
    return this.contentService.publishCourse(id);
  }

  @Post(':id/unpublish')
  @HttpCode(200)
  unpublish(@Param('id') id: string) {
    return this.contentService.unpublishCourse(id);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.contentService.deleteCourse(id);
  }
}
