import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { ContentService } from './content.service';

@Controller('sections')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.student)
export class StudentSectionsController {
  constructor(private readonly contentService: ContentService) {}

  @Get(':id')
  get(@Param('id') id: string) {
    return this.contentService.getPublishedSection(id);
  }

  @Get(':id/graph')
  getGraph(@Param('id') id: string) {
    return this.contentService.getPublishedSectionGraph(id);
  }
}
