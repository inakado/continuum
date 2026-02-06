import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { ContentService } from './content.service';

@Controller('units')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.student)
export class StudentUnitsController {
  constructor(private readonly contentService: ContentService) {}

  @Get(':id')
  async get(@Param('id') id: string) {
    const unit = await this.contentService.getPublishedUnit(id);
    return {
      ...unit,
      tasks: unit.tasks.map((task) => {
        const { solutionLite, correctAnswerJson, ...rest } = task as Record<string, unknown>;
        return rest;
      }),
    };
  }
}
