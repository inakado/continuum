import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { ContentStatus, Prisma } from '@prisma/client';
import type { PrismaService } from '../prisma/prisma.service';
import type { CreateUnitDto, UpdateUnitDto } from './dto/unit.dto';

type UnitVideo = { id: string; title: string; embedUrl: string };
type UnitAttachment = { id: string; name: string; urlOrKey?: string | null };

export class ContentWriteUnitService {
  constructor(private readonly prisma: PrismaService) {}

  async createUnit(dto: CreateUnitDto) {
    const section = await this.prisma.section.findUnique({ where: { id: dto.sectionId } });
    if (!section) throw new NotFoundException('Section not found');

    return this.prisma.unit.create({
      data: {
        sectionId: dto.sectionId,
        title: dto.title,
        sortOrder: dto.sortOrder ?? 0,
      },
    });
  }

  async updateUnit(id: string, dto: UpdateUnitDto) {
    const data: Prisma.UnitUpdateInput = {};
    if (dto.title !== undefined) data.title = dto.title;
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.sortOrder !== undefined) data.sortOrder = dto.sortOrder;
    if (dto.minOptionalCountedTasksToComplete !== undefined) {
      data.minOptionalCountedTasksToComplete = this.normalizeMinOptionalCountedTasksToComplete(
        dto.minOptionalCountedTasksToComplete,
      );
    }
    const normalizedRequiredTaskIds =
      dto.requiredTaskIds !== undefined
        ? this.normalizeRequiredTaskIds(dto.requiredTaskIds)
        : undefined;
    if (dto.theoryRichLatex !== undefined) {
      data.theoryRichLatex = this.sanitizeRichText(dto.theoryRichLatex);
    }
    if (dto.theoryPdfAssetKey !== undefined) {
      data.theoryPdfAssetKey = this.normalizeAssetKey(dto.theoryPdfAssetKey);
    }
    if (dto.methodRichLatex !== undefined) {
      data.methodRichLatex = this.sanitizeRichText(dto.methodRichLatex);
    }
    if (dto.methodPdfAssetKey !== undefined) {
      data.methodPdfAssetKey = this.normalizeAssetKey(dto.methodPdfAssetKey);
    }
    if (dto.videosJson !== undefined) {
      const videos = this.validateVideosJson(dto.videosJson);
      data.videosJson = videos === null ? Prisma.DbNull : (videos as unknown as Prisma.InputJsonValue);
    }
    if (dto.attachmentsJson !== undefined) {
      const attachments = this.validateAttachmentsJson(dto.attachmentsJson);
      data.attachmentsJson =
        attachments === null ? Prisma.DbNull : (attachments as unknown as Prisma.InputJsonValue);
    }

    return this.prisma.$transaction(async (tx) => {
      const unit = await tx.unit.findUnique({
        where: { id },
        select: { id: true },
      });
      if (!unit) throw new NotFoundException('Unit not found');

      if (normalizedRequiredTaskIds !== undefined && normalizedRequiredTaskIds.length > 0) {
        const requiredTasks = await tx.task.findMany({
          where: { id: { in: normalizedRequiredTaskIds } },
          select: { id: true, unitId: true },
        });
        if (requiredTasks.length !== normalizedRequiredTaskIds.length) {
          throw new BadRequestException('InvalidRequiredTaskIds');
        }
        const requiredTasksById = new Map(requiredTasks.map((task) => [task.id, task]));
        for (const taskId of normalizedRequiredTaskIds) {
          const task = requiredTasksById.get(taskId);
          if (!task || task.unitId !== id) {
            throw new BadRequestException('InvalidRequiredTaskIds');
          }
        }
      }

      if (normalizedRequiredTaskIds !== undefined && Object.keys(data).length === 0) {
        data.updatedAt = new Date();
      }

      const updatedUnit =
        Object.keys(data).length > 0
          ? await tx.unit.update({ where: { id }, data })
          : await tx.unit.findUnique({ where: { id } });
      if (!updatedUnit) throw new NotFoundException('Unit not found');

      if (normalizedRequiredTaskIds !== undefined) {
        await tx.task.updateMany({
          where: { unitId: id, isRequired: true },
          data: { isRequired: false },
        });
        if (normalizedRequiredTaskIds.length > 0) {
          await tx.task.updateMany({
            where: { unitId: id, id: { in: normalizedRequiredTaskIds } },
            data: { isRequired: true },
          });
        }
      }

      return updatedUnit;
    });
  }

  async publishUnit(id: string) {
    const unit = await this.prisma.unit.findUnique({
      where: { id },
      include: { section: true },
    });
    if (!unit) {
      throw new NotFoundException({
        code: 'UNIT_NOT_FOUND',
        message: 'Unit not found',
      });
    }

    if (unit.section.status !== ContentStatus.published) {
      throw new ConflictException({
        code: 'UNIT_PARENT_SECTION_DRAFT',
        message: 'Cannot publish Unit: parent Section is draft',
      });
    }

    return this.prisma.unit.update({
      where: { id },
      data: { status: ContentStatus.published },
    });
  }

  async unpublishUnit(id: string) {
    const exists = await this.prisma.unit.findUnique({ where: { id } });
    if (!exists) {
      throw new NotFoundException({
        code: 'UNIT_NOT_FOUND',
        message: 'Unit not found',
      });
    }

    return this.prisma.unit.update({
      where: { id },
      data: { status: ContentStatus.draft },
    });
  }

  async deleteUnit(id: string) {
    const exists = await this.prisma.unit.findUnique({
      where: { id },
      select: { id: true, sectionId: true },
    });
    if (!exists) {
      throw new NotFoundException({
        code: 'UNIT_NOT_FOUND',
        message: 'Unit not found',
      });
    }

    const tasksCount = await this.prisma.task.count({ where: { unitId: id } });
    if (tasksCount > 0) {
      throw new ConflictException({
        code: 'UNIT_HAS_TASKS',
        message: 'Cannot delete Unit: tasks exist',
      });
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.unitGraphEdge.deleteMany({
        where: {
          sectionId: exists.sectionId,
          OR: [{ prereqUnitId: id }, { unitId: id }],
        },
      });
      await tx.unitGraphLayout.deleteMany({
        where: { sectionId: exists.sectionId, unitId: id },
      });
      return tx.unit.delete({ where: { id } });
    });
  }

  private normalizeMinOptionalCountedTasksToComplete(value: unknown): number {
    if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
      throw new BadRequestException('InvalidMinOptionalCountedTasksToComplete');
    }
    return value;
  }

  private normalizeRequiredTaskIds(value: unknown): string[] {
    if (!Array.isArray(value)) throw new BadRequestException('InvalidRequiredTaskIds');

    const normalizedIds: string[] = [];
    const seenIds = new Set<string>();
    for (const id of value) {
      if (typeof id !== 'string') throw new BadRequestException('InvalidRequiredTaskIds');
      const trimmed = id.trim();
      if (!trimmed || seenIds.has(trimmed)) {
        throw new BadRequestException('InvalidRequiredTaskIds');
      }
      seenIds.add(trimmed);
      normalizedIds.push(trimmed);
    }

    return normalizedIds;
  }

  private sanitizeRichText(value: string | null | undefined): string | null {
    if (value === null) return null;
    if (value === undefined) return null;
    if (typeof value !== 'string') throw new BadRequestException('InvalidRichText');
    const trimmed = value.trim();
    if (trimmed.length > 200_000) throw new BadRequestException('InvalidRichText');
    return trimmed.length === 0 ? null : trimmed;
  }

  private normalizeAssetKey(value: string | null): string | null {
    if (value === null) return null;
    const trimmed = value.trim();
    return trimmed ? trimmed : null;
  }

  private validateVideosJson(value: unknown): UnitVideo[] | null {
    if (value === null) return null;
    if (!Array.isArray(value)) throw new BadRequestException('InvalidVideosJson');
    if (value.length > 20) throw new BadRequestException('InvalidVideosJson');

    const videos: UnitVideo[] = [];
    for (const item of value) {
      if (!item || typeof item !== 'object') throw new BadRequestException('InvalidVideosJson');
      const video = item as Record<string, unknown>;

      const id = typeof video.id === 'string' ? video.id.trim() : '';
      const title = typeof video.title === 'string' ? video.title.trim() : '';
      const embedUrl = typeof video.embedUrl === 'string' ? video.embedUrl.trim() : '';

      if (!id) throw new BadRequestException('InvalidVideosJson');
      if (title.length > 120) throw new BadRequestException('InvalidVideosJson');
      if (embedUrl.length > 2048) throw new BadRequestException('InvalidVideosJson');

      if (embedUrl.length > 0) {
        let parsed: URL;
        try {
          parsed = new URL(embedUrl);
        } catch {
          throw new BadRequestException('InvalidVideosJson');
        }
        if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
          throw new BadRequestException('InvalidVideosJson');
        }
      }

      videos.push({ id, title, embedUrl });
    }

    return videos;
  }

  private validateAttachmentsJson(value: unknown): UnitAttachment[] | null {
    if (value === null) return null;
    if (!Array.isArray(value)) throw new BadRequestException('InvalidAttachmentsJson');
    if (value.length > 50) throw new BadRequestException('InvalidAttachmentsJson');

    const attachments: UnitAttachment[] = [];
    for (const item of value) {
      if (!item || typeof item !== 'object') throw new BadRequestException('InvalidAttachmentsJson');
      const attachment = item as Record<string, unknown>;
      const id = typeof attachment.id === 'string' ? attachment.id.trim() : '';
      const name = typeof attachment.name === 'string' ? attachment.name.trim() : '';
      const urlOrKey =
        attachment.urlOrKey === null
          ? null
          : typeof attachment.urlOrKey === 'string'
            ? attachment.urlOrKey.trim()
            : undefined;

      if (!id) throw new BadRequestException('InvalidAttachmentsJson');
      if (!name || name.length > 140) throw new BadRequestException('InvalidAttachmentsJson');
      if (urlOrKey !== undefined && urlOrKey !== null && urlOrKey.length > 2048) {
        throw new BadRequestException('InvalidAttachmentsJson');
      }

      attachments.push({ id, name, urlOrKey });
    }

    return attachments;
  }
}
