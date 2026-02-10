import { Controller, Get, Param, Req, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { AuthRequest } from '../auth/auth.request';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { LearningService } from './learning.service';

@Controller('units')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.student)
export class StudentUnitsController {
  constructor(private readonly learningService: LearningService) {}

  @Get(':id')
  get(@Param('id') id: string, @Req() req: AuthRequest) {
    return this.learningService.getPublishedUnitForStudent(req.user.id, id);
  }
}
