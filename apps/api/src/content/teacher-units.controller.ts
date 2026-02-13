import {
  Body,
  BadRequestException,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { EventCategory, Role } from '@prisma/client';
import { AuthRequest } from '../auth/auth.request';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { EventsLogService } from '../events/events-log.service';
import { ObjectStorageService } from '../infra/storage/object-storage.service';
import { ContentService } from './content.service';
import { CreateUnitDto, UpdateUnitDto } from './dto/unit.dto';

@Controller('teacher/units')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.teacher)
export class TeacherUnitsController {
  constructor(
    private readonly contentService: ContentService,
    private readonly eventsLogService: EventsLogService,
    private readonly objectStorageService: ObjectStorageService,
  ) {}

  @Get(':id')
  get(@Param('id') id: string) {
    return this.contentService.getUnit(id);
  }

  @Get(':id/pdf-presign')
  async getPdfPresignedUrl(
    @Param('id') id: string,
    @Query('target') targetRaw: string | undefined,
    @Query('ttlSec') ttlRaw: string | undefined,
  ) {
    const target = this.parseTarget(targetRaw);
    const ttlSec = this.parseTtl(ttlRaw);
    const key = await this.contentService.getUnitPdfAssetKey(id, target);
    if (!key) {
      return {
        ok: true,
        target,
        key: null,
        expiresInSec: ttlSec,
        url: null,
      };
    }

    const url = await this.objectStorageService.getPresignedGetUrl(key, ttlSec);
    return {
      ok: true,
      target,
      key,
      expiresInSec: ttlSec,
      url,
    };
  }

  @Post()
  async create(@Body() dto: CreateUnitDto, @Req() req: AuthRequest) {
    const unit = await this.contentService.createUnit(dto);
    await this.eventsLogService.append({
      category: EventCategory.admin,
      eventType: 'UnitCreated',
      actorUserId: req.user.id,
      actorRole: req.user.role,
      entityType: 'unit',
      entityId: unit.id,
      payload: {
        title: unit.title,
        status: unit.status,
        sectionId: unit.sectionId,
        sortOrder: unit.sortOrder,
      },
    });
    return unit;
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateUnitDto, @Req() req: AuthRequest) {
    const unit = await this.contentService.updateUnit(id, dto);
    const changedFields = Object.entries(dto)
      .filter(([, value]) => value !== undefined)
      .map(([key]) => key);

    const sizes: Record<string, number> = {};
    if ('theoryRichLatex' in dto && dto.theoryRichLatex !== undefined) {
      sizes.theory = (dto.theoryRichLatex ?? '').length;
    }
    if ('methodRichLatex' in dto && dto.methodRichLatex !== undefined) {
      sizes.method = (dto.methodRichLatex ?? '').length;
    }
    if ('videosJson' in dto && dto.videosJson !== undefined) {
      try {
        sizes.videos = JSON.stringify(dto.videosJson ?? []).length;
      } catch {
        // ignore
      }
    }
    if ('attachmentsJson' in dto && dto.attachmentsJson !== undefined) {
      try {
        sizes.attachments = JSON.stringify(dto.attachmentsJson ?? []).length;
      } catch {
        // ignore
      }
    }

    await this.eventsLogService.append({
      category: EventCategory.admin,
      eventType: 'UnitUpdated',
      actorUserId: req.user.id,
      actorRole: req.user.role,
      entityType: 'unit',
      entityId: unit.id,
      payload: {
        title: unit.title,
        status: unit.status,
        sectionId: unit.sectionId,
        sortOrder: unit.sortOrder,
        changedFields,
        sizes: Object.keys(sizes).length > 0 ? sizes : undefined,
      },
    });
    return unit;
  }

  @Post(':id/publish')
  @HttpCode(200)
  async publish(@Param('id') id: string, @Req() req: AuthRequest) {
    const unit = await this.contentService.publishUnit(id);
    await this.eventsLogService.append({
      category: EventCategory.admin,
      eventType: 'UnitPublished',
      actorUserId: req.user.id,
      actorRole: req.user.role,
      entityType: 'unit',
      entityId: unit.id,
      payload: { title: unit.title, status: unit.status, sectionId: unit.sectionId },
    });
    return unit;
  }

  @Post(':id/unpublish')
  @HttpCode(200)
  async unpublish(@Param('id') id: string, @Req() req: AuthRequest) {
    const unit = await this.contentService.unpublishUnit(id);
    await this.eventsLogService.append({
      category: EventCategory.admin,
      eventType: 'UnitUnpublished',
      actorUserId: req.user.id,
      actorRole: req.user.role,
      entityType: 'unit',
      entityId: unit.id,
      payload: { title: unit.title, status: unit.status, sectionId: unit.sectionId },
    });
    return unit;
  }

  @Delete(':id')
  async remove(@Param('id') id: string, @Req() req: AuthRequest) {
    const unit = await this.contentService.deleteUnit(id);
    await this.eventsLogService.append({
      category: EventCategory.admin,
      eventType: 'UnitDeleted',
      actorUserId: req.user.id,
      actorRole: req.user.role,
      entityType: 'unit',
      entityId: unit.id,
      payload: { title: unit.title, status: unit.status, sectionId: unit.sectionId },
    });
    return unit;
  }

  private parseTarget(value: string | undefined): 'theory' | 'method' {
    if (value === 'theory' || value === 'method') return value;
    throw new BadRequestException('target must be one of: theory | method');
  }

  private parseTtl(raw: string | undefined): number {
    if (raw === undefined || raw === null || raw === '') return 900;
    const parsed = Number(raw);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      throw new BadRequestException('ttlSec must be a positive integer');
    }
    const ttl = Math.floor(parsed);
    if (ttl > 86_400) {
      throw new BadRequestException('ttlSec must be <= 86400');
    }
    return ttl;
  }
}
