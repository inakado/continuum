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
import { CreateUnitDto, UpdateUnitDto } from './dto/unit.dto';

@Controller('teacher/units')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.teacher)
export class TeacherUnitsController {
  constructor(private readonly contentService: ContentService) {}

  @Get(':id')
  get(@Param('id') id: string) {
    return this.contentService.getUnit(id);
  }

  @Post()
  create(@Body() dto: CreateUnitDto) {
    return this.contentService.createUnit(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateUnitDto) {
    return this.contentService.updateUnit(id, dto);
  }

  @Post(':id/publish')
  @HttpCode(200)
  publish(@Param('id') id: string) {
    return this.contentService.publishUnit(id);
  }

  @Post(':id/unpublish')
  @HttpCode(200)
  unpublish(@Param('id') id: string) {
    return this.contentService.unpublishUnit(id);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.contentService.deleteUnit(id);
  }
}
