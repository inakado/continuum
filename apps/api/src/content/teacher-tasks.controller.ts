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
import { CreateTaskDto, UpdateTaskDto } from './dto/task.dto';

@Controller('teacher/tasks')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.teacher)
export class TeacherTasksController {
  constructor(private readonly contentService: ContentService) {}

  @Get(':id')
  get(@Param('id') id: string) {
    return this.contentService.getTask(id);
  }

  @Post()
  create(@Body() dto: CreateTaskDto) {
    return this.contentService.createTask(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateTaskDto) {
    return this.contentService.updateTask(id, dto);
  }

  @Post(':id/publish')
  @HttpCode(200)
  publish(@Param('id') id: string) {
    return this.contentService.publishTask(id);
  }

  @Post(':id/unpublish')
  @HttpCode(200)
  unpublish(@Param('id') id: string) {
    return this.contentService.unpublishTask(id);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.contentService.deleteTask(id);
  }
}
