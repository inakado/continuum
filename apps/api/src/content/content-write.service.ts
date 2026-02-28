import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ContentStatus, Prisma, TaskAnswerType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { type CreateCourseDto, type UpdateCourseDto } from './dto/course.dto';
import { type CreateSectionDto, type UpdateSectionDto } from './dto/section.dto';
import { type CreateTaskDto, type UpdateTaskDto } from './dto/task.dto';
import { type CreateUnitDto, type UpdateUnitDto } from './dto/unit.dto';
import {
  TaskRevisionPayloadService,
  type TaskRevisionRecord,
  type TaskWithActiveRevision,
} from './task-revision-payload.service';

type UnitVideo = { id: string; title: string; embedUrl: string };
type UnitAttachment = { id: string; name: string; urlOrKey?: string | null };

@Injectable()
export class ContentWriteService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly taskRevisionPayloadService: TaskRevisionPayloadService,
  ) {}

  async createCourse(dto: CreateCourseDto) {
    return this.prisma.course.create({
      data: {
        title: dto.title,
        description: dto.description ?? null,
      },
    });
  }

  async updateCourse(id: string, dto: UpdateCourseDto) {
    const exists = await this.prisma.course.findUnique({ where: { id } });
    if (!exists) throw new NotFoundException('Course not found');

    const data: { title?: string; description?: string | null } = {};
    if (dto.title !== undefined) data.title = dto.title;
    if (dto.description !== undefined) data.description = dto.description;

    return this.prisma.course.update({ where: { id }, data });
  }

  async publishCourse(id: string) {
    const exists = await this.prisma.course.findUnique({ where: { id } });
    if (!exists) throw new NotFoundException('Course not found');

    return this.prisma.course.update({
      where: { id },
      data: { status: ContentStatus.published },
    });
  }

  async unpublishCourse(id: string) {
    const exists = await this.prisma.course.findUnique({ where: { id } });
    if (!exists) throw new NotFoundException('Course not found');

    return this.prisma.course.update({
      where: { id },
      data: { status: ContentStatus.draft },
    });
  }

  async deleteCourse(id: string) {
    const exists = await this.prisma.course.findUnique({ where: { id } });
    if (!exists) throw new NotFoundException('Course not found');

    const sectionsCount = await this.prisma.section.count({ where: { courseId: id } });
    if (sectionsCount > 0) {
      throw new ConflictException('Cannot delete Course: sections exist');
    }

    return this.prisma.course.delete({ where: { id } });
  }

  async createSection(dto: CreateSectionDto) {
    const course = await this.prisma.course.findUnique({ where: { id: dto.courseId } });
    if (!course) throw new NotFoundException('Course not found');

    return this.prisma.section.create({
      data: {
        courseId: dto.courseId,
        title: dto.title,
        description: dto.description ?? null,
        sortOrder: dto.sortOrder ?? 0,
      },
    });
  }

  async updateSection(id: string, dto: UpdateSectionDto) {
    const exists = await this.prisma.section.findUnique({ where: { id } });
    if (!exists) throw new NotFoundException('Section not found');

    const data: { title?: string; description?: string | null; sortOrder?: number } = {};
    if (dto.title !== undefined) data.title = dto.title;
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.sortOrder !== undefined) data.sortOrder = dto.sortOrder;

    return this.prisma.section.update({ where: { id }, data });
  }

  async publishSection(id: string) {
    const section = await this.prisma.section.findUnique({
      where: { id },
      include: { course: true },
    });
    if (!section) throw new NotFoundException('Section not found');

    if (section.course.status !== ContentStatus.published) {
      throw new ConflictException('Cannot publish Section: parent Course is draft');
    }

    return this.prisma.section.update({
      where: { id },
      data: { status: ContentStatus.published },
    });
  }

  async unpublishSection(id: string) {
    const exists = await this.prisma.section.findUnique({ where: { id } });
    if (!exists) throw new NotFoundException('Section not found');

    return this.prisma.section.update({
      where: { id },
      data: { status: ContentStatus.draft },
    });
  }

  async deleteSection(id: string) {
    const exists = await this.prisma.section.findUnique({ where: { id } });
    if (!exists) throw new NotFoundException('Section not found');

    const unitsCount = await this.prisma.unit.count({ where: { sectionId: id } });
    if (unitsCount > 0) {
      throw new ConflictException('Cannot delete Section: units exist');
    }

    return this.prisma.section.delete({ where: { id } });
  }

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

  async updateTaskRevisionSolutionRichLatex(taskRevisionId: string, latex: string) {
    return this.prisma.taskRevision.update({
      where: { id: taskRevisionId },
      data: {
        solutionRichLatex: latex,
      },
      select: {
        id: true,
        taskId: true,
      },
    });
  }

  async setTaskRevisionSolutionPdfAssetKey(taskRevisionId: string, key: string) {
    return this.prisma.taskRevision.update({
      where: { id: taskRevisionId },
      data: {
        solutionPdfAssetKey: key,
      },
      select: {
        id: true,
        taskId: true,
        solutionPdfAssetKey: true,
      },
    });
  }

  async setTaskRevisionStatementImageAssetKey(taskRevisionId: string, key: string | null) {
    return this.prisma.taskRevision.update({
      where: { id: taskRevisionId },
      data: {
        statementImageAssetKey: key,
      },
      select: {
        id: true,
        taskId: true,
        statementImageAssetKey: true,
      },
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

  async createTask(dto: CreateTaskDto) {
    const unit = await this.prisma.unit.findUnique({ where: { id: dto.unitId } });
    if (!unit) throw new NotFoundException('Unit not found');

    const normalized = this.taskRevisionPayloadService.normalizeTaskPayload({
      answerType: dto.answerType,
      statementLite: dto.statementLite,
      numericPartsJson: dto.numericPartsJson,
      choicesJson: dto.choicesJson,
      correctAnswerJson: dto.correctAnswerJson,
      statementImageAssetKey: null,
      solutionLite: dto.solutionLite ?? null,
      solutionRichLatex: null,
      solutionPdfAssetKey: null,
    });

    return this.prisma.$transaction(async (tx) => {
      const task = await tx.task.create({
        data: {
          unitId: dto.unitId,
          title: null,
          isRequired: dto.isRequired ?? false,
          sortOrder: dto.sortOrder ?? 0,
        },
      });

      const revision = await this.taskRevisionPayloadService.createTaskRevision(
        tx,
        task.id,
        1,
        normalized,
      );
      const updatedTask = await tx.task.update({
        where: { id: task.id },
        data: { activeRevisionId: revision.id },
      });
      if (!updatedTask.activeRevisionId) {
        throw new ConflictException({
          code: 'TASK_ACTIVE_REVISION_MISSING',
          message: 'Task active revision is missing',
        });
      }

      const correctKeys =
        normalized.answerType === TaskAnswerType.single_choice
          ? normalized.correctAnswerJson?.key
            ? [normalized.correctAnswerJson.key]
            : []
          : normalized.correctAnswerJson?.keys ?? [];

      const revisionSnapshot: TaskRevisionRecord = {
        id: revision.id,
        answerType: revision.answerType,
        statementLite: revision.statementLite,
        statementImageAssetKey: revision.statementImageAssetKey,
        solutionLite: revision.solutionLite,
        solutionRichLatex: revision.solutionRichLatex,
        solutionPdfAssetKey: revision.solutionPdfAssetKey,
        numericParts:
          normalized.numericPartsJson?.map((part) => ({
            partKey: part.key,
            labelLite: part.labelLite ?? null,
            correctValue: part.correctValue,
          })) ?? [],
        choices:
          normalized.choicesJson?.map((choice) => ({
            choiceKey: choice.key,
            contentLite: choice.textLite,
          })) ?? [],
        correctChoices: correctKeys.map((key) => ({ choiceKey: key })),
      };

      return this.taskRevisionPayloadService.mapTaskWithRevision({
        id: updatedTask.id,
        unitId: updatedTask.unitId,
        title: updatedTask.title,
        isRequired: updatedTask.isRequired,
        status: updatedTask.status,
        sortOrder: updatedTask.sortOrder,
        createdAt: updatedTask.createdAt,
        updatedAt: updatedTask.updatedAt,
        activeRevision: revisionSnapshot,
      } as TaskWithActiveRevision);
    });
  }

  async updateTask(id: string, dto: UpdateTaskDto) {
    const current = await this.prisma.task.findUnique({
      where: { id },
      include: {
        activeRevision: {
          include: {
            numericParts: true,
            choices: true,
            correctChoices: true,
          },
        },
      },
    });
    if (!current) throw new NotFoundException('Task not found');
    const currentView = this.taskRevisionPayloadService.mapTaskWithRevision(
      current as TaskWithActiveRevision,
    );

    const merged = {
      title: null,
      statementLite: dto.statementLite ?? currentView.statementLite,
      answerType: (dto.answerType ?? currentView.answerType) as TaskAnswerType,
      numericPartsJson:
        dto.numericPartsJson !== undefined ? dto.numericPartsJson : currentView.numericPartsJson,
      choicesJson: dto.choicesJson !== undefined ? dto.choicesJson : currentView.choicesJson,
      correctAnswerJson:
        dto.correctAnswerJson !== undefined
          ? dto.correctAnswerJson
          : currentView.correctAnswerJson,
      statementImageAssetKey: currentView.statementImageAssetKey ?? null,
      solutionLite: dto.solutionLite !== undefined ? dto.solutionLite : currentView.solutionLite,
      solutionRichLatex: currentView.solutionRichLatex ?? null,
      solutionPdfAssetKey: currentView.solutionPdfAssetKey ?? null,
      isRequired: dto.isRequired ?? currentView.isRequired,
      sortOrder: dto.sortOrder ?? currentView.sortOrder,
    };

    const normalized = this.taskRevisionPayloadService.normalizeTaskPayload({
      answerType: merged.answerType,
      statementLite: merged.statementLite,
      numericPartsJson: merged.numericPartsJson,
      choicesJson: merged.choicesJson,
      correctAnswerJson: merged.correctAnswerJson,
      statementImageAssetKey: merged.statementImageAssetKey,
      solutionLite: merged.solutionLite ?? null,
      solutionRichLatex: merged.solutionRichLatex,
      solutionPdfAssetKey: merged.solutionPdfAssetKey,
    });

    return this.prisma.$transaction(async (tx) => {
      const revisionNo = await this.taskRevisionPayloadService.nextTaskRevisionNo(tx, id);
      const revision = await this.taskRevisionPayloadService.createTaskRevision(
        tx,
        id,
        revisionNo,
        normalized,
      );
      const updatedTask = await tx.task.update({
        where: { id },
        data: {
          title: null,
          isRequired: merged.isRequired,
          sortOrder: merged.sortOrder,
          activeRevisionId: revision.id,
        },
      });
      if (!updatedTask.activeRevisionId) {
        throw new ConflictException({
          code: 'TASK_ACTIVE_REVISION_MISSING',
          message: 'Task active revision is missing',
        });
      }

      const correctKeys =
        normalized.answerType === TaskAnswerType.single_choice
          ? normalized.correctAnswerJson?.key
            ? [normalized.correctAnswerJson.key]
            : []
          : normalized.correctAnswerJson?.keys ?? [];

      const revisionSnapshot: TaskRevisionRecord = {
        id: revision.id,
        answerType: revision.answerType,
        statementLite: revision.statementLite,
        statementImageAssetKey: revision.statementImageAssetKey,
        solutionLite: revision.solutionLite,
        solutionRichLatex: revision.solutionRichLatex,
        solutionPdfAssetKey: revision.solutionPdfAssetKey,
        numericParts:
          normalized.numericPartsJson?.map((part) => ({
            partKey: part.key,
            labelLite: part.labelLite ?? null,
            correctValue: part.correctValue,
          })) ?? [],
        choices:
          normalized.choicesJson?.map((choice) => ({
            choiceKey: choice.key,
            contentLite: choice.textLite,
          })) ?? [],
        correctChoices: correctKeys.map((key) => ({ choiceKey: key })),
      };

      return this.taskRevisionPayloadService.mapTaskWithRevision({
        id: updatedTask.id,
        unitId: updatedTask.unitId,
        title: updatedTask.title,
        isRequired: updatedTask.isRequired,
        status: updatedTask.status,
        sortOrder: updatedTask.sortOrder,
        createdAt: updatedTask.createdAt,
        updatedAt: updatedTask.updatedAt,
        activeRevision: revisionSnapshot,
      } as TaskWithActiveRevision);
    });
  }

  async publishTask(id: string) {
    const task = await this.prisma.task.findUnique({
      where: { id },
      include: { unit: true },
    });
    if (!task) {
      throw new NotFoundException({
        code: 'TASK_NOT_FOUND',
        message: 'Task not found',
      });
    }

    if (task.unit.status !== ContentStatus.published) {
      throw new ConflictException({
        code: 'TASK_PARENT_UNIT_DRAFT',
        message: 'Cannot publish Task: parent Unit is draft',
      });
    }

    return this.prisma.task.update({
      where: { id },
      data: { status: ContentStatus.published },
    });
  }

  async unpublishTask(id: string) {
    const exists = await this.prisma.task.findUnique({ where: { id } });
    if (!exists) {
      throw new NotFoundException({
        code: 'TASK_NOT_FOUND',
        message: 'Task not found',
      });
    }

    return this.prisma.task.update({
      where: { id },
      data: { status: ContentStatus.draft },
    });
  }

  async deleteTask(id: string) {
    const exists = await this.prisma.task.findUnique({ where: { id } });
    if (!exists) throw new NotFoundException('Task not found');

    return this.prisma.task.delete({ where: { id } });
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
      const v = item as Record<string, unknown>;

      const id = typeof v.id === 'string' ? v.id.trim() : '';
      const title = typeof v.title === 'string' ? v.title.trim() : '';
      const embedUrl = typeof v.embedUrl === 'string' ? v.embedUrl.trim() : '';

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
      const a = item as Record<string, unknown>;
      const id = typeof a.id === 'string' ? a.id.trim() : '';
      const name = typeof a.name === 'string' ? a.name.trim() : '';
      const urlOrKey =
        a.urlOrKey === null
          ? null
          : typeof a.urlOrKey === 'string'
            ? a.urlOrKey.trim()
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
