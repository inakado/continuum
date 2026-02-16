import { Body, Controller, Get, HttpCode, Param, Put, Req, UseGuards } from '@nestjs/common';
import { EventCategory, Role } from '@prisma/client';
import { AuthRequest } from '../auth/auth.request';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { EventsLogService } from '../events/events-log.service';
import { LearningRecomputeService } from '../learning/learning-recompute.service';
import { ContentService } from './content.service';
import { UpdateSectionGraphDto } from './dto/graph.dto';

@Controller('teacher/sections')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.teacher)
export class TeacherSectionGraphController {
  constructor(
    private readonly contentService: ContentService,
    private readonly eventsLogService: EventsLogService,
    private readonly learningRecomputeService: LearningRecomputeService,
  ) {}

  @Get(':id/graph')
  getGraph(@Param('id') id: string) {
    return this.contentService.getSectionGraph(id);
  }

  @Put(':id/graph')
  @HttpCode(200)
  async updateGraph(
    @Param('id') id: string,
    @Body() dto: UpdateSectionGraphDto,
    @Req() req: AuthRequest,
  ) {
    const graph = await this.contentService.updateSectionGraph(id, dto.nodes ?? [], dto.edges ?? []);
    await this.learningRecomputeService.recomputeForSection(id);
    await this.eventsLogService.append({
      category: EventCategory.admin,
      eventType: 'UnitGraphUpdated',
      actorUserId: req.user.id,
      actorRole: req.user.role,
      entityType: 'section',
      entityId: id,
      payload: {
        nodes: graph.nodes.length,
        edges: graph.edges.length,
      },
    });
    return graph;
  }
}
