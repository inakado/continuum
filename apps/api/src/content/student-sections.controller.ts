import { Controller, Get, Inject, Param, Req, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { type AuthRequest } from '../auth/auth.request';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { LearningService } from '../learning/learning.service';

@Controller('sections')
@UseGuards(RolesGuard)
@Roles(Role.student)
export class StudentSectionsController {
  constructor(@Inject(LearningService) private readonly learningService: LearningService) {}

  @Get(':id')
  get(@Param('id') id: string, @Req() req: AuthRequest) {
    return this.learningService.getPublishedSectionForStudent(req.user.id, id);
  }
}
