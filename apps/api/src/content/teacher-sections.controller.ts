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
import { CreateSectionDto, UpdateSectionDto } from './dto/section.dto';

@Controller('teacher/sections')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.teacher)
export class TeacherSectionsController {
  constructor(private readonly contentService: ContentService) {}

  @Get(':id')
  get(@Param('id') id: string) {
    return this.contentService.getSection(id);
  }

  @Post()
  create(@Body() dto: CreateSectionDto) {
    return this.contentService.createSection(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateSectionDto) {
    return this.contentService.updateSection(id, dto);
  }

  @Post(':id/publish')
  @HttpCode(200)
  publish(@Param('id') id: string) {
    return this.contentService.publishSection(id);
  }

  @Post(':id/unpublish')
  @HttpCode(200)
  unpublish(@Param('id') id: string) {
    return this.contentService.unpublishSection(id);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.contentService.deleteSection(id);
  }
}
