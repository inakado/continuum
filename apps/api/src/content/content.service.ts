import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ContentStatus, Prisma, TaskAnswerType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCourseDto, UpdateCourseDto } from './dto/course.dto';
import { CreateSectionDto, UpdateSectionDto } from './dto/section.dto';
import { CreateUnitDto, UpdateUnitDto } from './dto/unit.dto';
import { CreateTaskDto, UpdateTaskDto } from './dto/task.dto';

type UnitVideo = { id: string; title: string; embedUrl: string };
type UnitAttachment = { id: string; name: string; urlOrKey?: string | null };
type NumericPart = { key: string; labelLite?: string | null; correctValue: string };
type Choice = { key: string; textLite: string };
type CorrectAnswer = { key?: string; keys?: string[] };

type TaskRevisionRecord = {
  id: string;
  answerType: TaskAnswerType;
  statementLite: string;
  solutionLite: string | null;
  numericParts: { partKey: string; labelLite: string | null; correctValue: string }[];
  choices: { choiceKey: string; contentLite: string }[];
  correctChoices: { choiceKey: string }[];
};

type TaskWithActiveRevision = {
  id: string;
  unitId: string;
  title: string | null;
  isRequired: boolean;
  status: ContentStatus;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
  activeRevision: TaskRevisionRecord;
};

type GraphNode = {
  unitId: string;
  title: string;
  status: ContentStatus;
  position: { x: number; y: number };
};

type GraphEdge = {
  id: string;
  fromUnitId: string;
  toUnitId: string;
};

type GraphUpdateNode = {
  unitId: string;
  position: { x: number; y: number };
};

type GraphUpdateEdge = {
  fromUnitId: string;
  toUnitId: string;
};

@Injectable()
export class ContentService {
  constructor(private readonly prisma: PrismaService) {}

  async listCourses() {
    return this.prisma.course.findMany({ orderBy: { createdAt: 'asc' } });
  }

  async listPublishedCourses() {
    return this.prisma.course.findMany({
      where: { status: ContentStatus.published },
      orderBy: { createdAt: 'asc' },
    });
  }

  async getCourse(id: string) {
    const course = await this.prisma.course.findUnique({
      where: { id },
      include: {
        sections: { orderBy: { sortOrder: 'asc' } },
      },
    });
    if (!course) throw new NotFoundException('Course not found');
    return course;
  }

  async getPublishedCourse(id: string) {
    const course = await this.prisma.course.findFirst({
      where: { id, status: ContentStatus.published },
      include: {
        sections: {
          where: { status: ContentStatus.published },
          orderBy: { sortOrder: 'asc' },
        },
      },
    });
    if (!course) throw new NotFoundException('Course not found');
    return course;
  }

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

  async getSection(id: string) {
    const section = await this.prisma.section.findUnique({
      where: { id },
      include: { units: { orderBy: { sortOrder: 'asc' } } },
    });
    if (!section) throw new NotFoundException('Section not found');
    return section;
  }

  async getPublishedSection(id: string) {
    const section = await this.prisma.section.findFirst({
      where: {
        id,
        status: ContentStatus.published,
        course: { status: ContentStatus.published },
      },
      include: {
        units: {
          where: { status: ContentStatus.published },
          orderBy: { sortOrder: 'asc' },
        },
      },
    });
    if (!section) throw new NotFoundException('Section not found');
    return section;
  }

  async getSectionGraph(sectionId: string) {
    const section = await this.prisma.section.findUnique({
      where: { id: sectionId },
      include: {
        units: { orderBy: { sortOrder: 'asc' } },
      },
    });
    if (!section) throw new NotFoundException('Section not found');

    return this.buildSectionGraph(sectionId, section.units);
  }

  async getPublishedSectionGraph(sectionId: string) {
    const section = await this.prisma.section.findFirst({
      where: {
        id: sectionId,
        status: ContentStatus.published,
        course: { status: ContentStatus.published },
      },
      include: {
        units: {
          where: { status: ContentStatus.published },
          orderBy: { sortOrder: 'asc' },
        },
      },
    });
    if (!section) throw new NotFoundException('Section not found');

    return this.buildSectionGraph(sectionId, section.units);
  }

  async updateSectionGraph(
    sectionId: string,
    nodes: GraphUpdateNode[],
    edges: GraphUpdateEdge[],
  ) {
    const section = await this.prisma.section.findUnique({
      where: { id: sectionId },
      select: { id: true },
    });
    if (!section) throw new NotFoundException('Section not found');

    const units = await this.prisma.unit.findMany({
      where: { sectionId },
      select: { id: true },
    });
    const unitIdSet = new Set(units.map((unit) => unit.id));

    for (const node of nodes) {
      if (!unitIdSet.has(node.unitId)) {
        throw new NotFoundException('Unit not found in section');
      }
    }

    const edgeKeySet = new Set<string>();
    for (const edge of edges) {
      if (!unitIdSet.has(edge.fromUnitId) || !unitIdSet.has(edge.toUnitId)) {
        throw new NotFoundException('Unit not found in section');
      }
      if (edge.fromUnitId === edge.toUnitId) {
        throw new ConflictException('GraphSelfLoopNotAllowed');
      }
      const key = `${edge.fromUnitId}:${edge.toUnitId}`;
      if (edgeKeySet.has(key)) {
        throw new ConflictException('GraphDuplicateEdgeNotAllowed');
      }
      edgeKeySet.add(key);
    }

    if (this.hasGraphCycle(unitIdSet, edges)) {
      throw new ConflictException('GraphCycleNotAllowed');
    }

    const updatedAt = new Date();

    await this.prisma.$transaction(async (tx) => {
      await tx.unitGraphEdge.deleteMany({ where: { sectionId } });
      if (edges.length > 0) {
        await tx.unitGraphEdge.createMany({
          data: edges.map((edge) => ({
            sectionId,
            prereqUnitId: edge.fromUnitId,
            unitId: edge.toUnitId,
          })),
        });
      }

      await tx.unitGraphLayout.deleteMany({ where: { sectionId } });
      if (nodes.length > 0) {
        await tx.unitGraphLayout.createMany({
          data: nodes.map((node) => ({
            sectionId,
            unitId: node.unitId,
            x: node.position.x,
            y: node.position.y,
            updatedAt,
          })),
        });
      }
    });

    return this.getSectionGraph(sectionId);
  }

  async createSection(dto: CreateSectionDto) {
    const course = await this.prisma.course.findUnique({ where: { id: dto.courseId } });
    if (!course) throw new NotFoundException('Course not found');

    return this.prisma.section.create({
      data: {
        courseId: dto.courseId,
        title: dto.title,
        sortOrder: dto.sortOrder ?? 0,
      },
    });
  }

  async updateSection(id: string, dto: UpdateSectionDto) {
    const exists = await this.prisma.section.findUnique({ where: { id } });
    if (!exists) throw new NotFoundException('Section not found');

    const data: { title?: string; sortOrder?: number } = {};
    if (dto.title !== undefined) data.title = dto.title;
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

  async getUnit(id: string) {
    const unit = await this.prisma.unit.findUnique({
      where: { id },
      include: {
        tasks: {
          orderBy: { sortOrder: 'asc' },
          include: {
            activeRevision: {
              include: {
                numericParts: true,
                choices: true,
                correctChoices: true,
              },
            },
          },
        },
      },
    });
    if (!unit) throw new NotFoundException('Unit not found');
    return {
      ...unit,
      tasks: unit.tasks.map((task) => this.mapTaskWithRevision(task as TaskWithActiveRevision)),
    };
  }

  async getPublishedUnit(id: string) {
    const unit = await this.prisma.unit.findFirst({
      where: {
        id,
        status: ContentStatus.published,
        section: {
          status: ContentStatus.published,
          course: { status: ContentStatus.published },
        },
      },
      include: {
        tasks: {
          where: { status: ContentStatus.published },
          orderBy: { sortOrder: 'asc' },
          include: {
            activeRevision: {
              include: {
                numericParts: true,
                choices: true,
                correctChoices: true,
              },
            },
          },
        },
      },
    });
    if (!unit) throw new NotFoundException('Unit not found');
    return {
      ...unit,
      tasks: unit.tasks.map((task) => this.mapTaskWithRevision(task as TaskWithActiveRevision)),
    };
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
    if (dto.methodRichLatex !== undefined) {
      data.methodRichLatex = this.sanitizeRichText(dto.methodRichLatex);
    }
    if (dto.videosJson !== undefined) {
      const videos = this.validateVideosJson(dto.videosJson);
      data.videosJson =
        videos === null ? Prisma.DbNull : (videos as unknown as Prisma.InputJsonValue);
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

      if (normalizedRequiredTaskIds !== undefined) {
        if (normalizedRequiredTaskIds.length > 0) {
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
    if (!unit) throw new NotFoundException('Unit not found');

    if (unit.section.status !== ContentStatus.published) {
      throw new ConflictException('Cannot publish Unit: parent Section is draft');
    }

    return this.prisma.unit.update({
      where: { id },
      data: { status: ContentStatus.published },
    });
  }

  async unpublishUnit(id: string) {
    const exists = await this.prisma.unit.findUnique({ where: { id } });
    if (!exists) throw new NotFoundException('Unit not found');

    return this.prisma.unit.update({
      where: { id },
      data: { status: ContentStatus.draft },
    });
  }

  async deleteUnit(id: string) {
    const exists = await this.prisma.unit.findUnique({ where: { id } });
    if (!exists) throw new NotFoundException('Unit not found');

    const tasksCount = await this.prisma.task.count({ where: { unitId: id } });
    if (tasksCount > 0) {
      throw new ConflictException('Cannot delete Unit: tasks exist');
    }

    return this.prisma.unit.delete({ where: { id } });
  }

  async getTask(id: string) {
    const task = await this.prisma.task.findUnique({
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
    if (!task) throw new NotFoundException('Task not found');
    return this.mapTaskWithRevision(task as TaskWithActiveRevision);
  }

  async createTask(dto: CreateTaskDto) {
    const unit = await this.prisma.unit.findUnique({ where: { id: dto.unitId } });
    if (!unit) throw new NotFoundException('Unit not found');

    const normalized = this.normalizeTaskPayload({
      answerType: dto.answerType,
      statementLite: dto.statementLite,
      numericPartsJson: dto.numericPartsJson,
      choicesJson: dto.choicesJson,
      correctAnswerJson: dto.correctAnswerJson,
      solutionLite: dto.solutionLite ?? null,
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

      const revision = await this.createTaskRevision(tx, task.id, 1, normalized);
      const updatedTask = await tx.task.update({
        where: { id: task.id },
        data: { activeRevisionId: revision.id },
      });
      if (!updatedTask.activeRevisionId) {
        throw new ConflictException('TASK_ACTIVE_REVISION_MISSING');
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
        solutionLite: revision.solutionLite,
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

      return this.mapTaskWithRevision({
        id: updatedTask.id,
        unitId: updatedTask.unitId,
        title: updatedTask.title,
        isRequired: updatedTask.isRequired,
        status: updatedTask.status,
        sortOrder: updatedTask.sortOrder,
        createdAt: updatedTask.createdAt,
        updatedAt: updatedTask.updatedAt,
        activeRevision: revisionSnapshot,
      });
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
    const currentView = this.mapTaskWithRevision(current as TaskWithActiveRevision);

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
      solutionLite:
        dto.solutionLite !== undefined ? dto.solutionLite : currentView.solutionLite,
      isRequired: dto.isRequired ?? currentView.isRequired,
      sortOrder: dto.sortOrder ?? currentView.sortOrder,
    };

    const normalized = this.normalizeTaskPayload({
      answerType: merged.answerType,
      statementLite: merged.statementLite,
      numericPartsJson: merged.numericPartsJson,
      choicesJson: merged.choicesJson,
      correctAnswerJson: merged.correctAnswerJson,
      solutionLite: merged.solutionLite ?? null,
    });

    return this.prisma.$transaction(async (tx) => {
      const revisionNo = await this.nextTaskRevisionNo(tx, id);
      const revision = await this.createTaskRevision(tx, id, revisionNo, normalized);
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
        throw new ConflictException('TASK_ACTIVE_REVISION_MISSING');
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
        solutionLite: revision.solutionLite,
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

      return this.mapTaskWithRevision({
        id: updatedTask.id,
        unitId: updatedTask.unitId,
        title: updatedTask.title,
        isRequired: updatedTask.isRequired,
        status: updatedTask.status,
        sortOrder: updatedTask.sortOrder,
        createdAt: updatedTask.createdAt,
        updatedAt: updatedTask.updatedAt,
        activeRevision: revisionSnapshot,
      });
    });
  }

  async publishTask(id: string) {
    const task = await this.prisma.task.findUnique({
      where: { id },
      include: { unit: true },
    });
    if (!task) throw new NotFoundException('Task not found');

    if (task.unit.status !== ContentStatus.published) {
      throw new ConflictException('Cannot publish Task: parent Unit is draft');
    }

    return this.prisma.task.update({
      where: { id },
      data: { status: ContentStatus.published },
    });
  }

  async unpublishTask(id: string) {
    const exists = await this.prisma.task.findUnique({ where: { id } });
    if (!exists) throw new NotFoundException('Task not found');

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

  private sortByKey<T extends { key: string }>(items: T[]): T[] {
    return [...items].sort((a, b) => {
      const aNum = Number(a.key);
      const bNum = Number(b.key);
      const aIsNum = Number.isFinite(aNum) && String(aNum) === a.key;
      const bIsNum = Number.isFinite(bNum) && String(bNum) === b.key;
      if (aIsNum && bIsNum) return aNum - bNum;
      return a.key.localeCompare(b.key);
    });
  }

  mapTaskWithRevision(task: TaskWithActiveRevision) {
    if (!task.activeRevision) {
      throw new ConflictException('Task revision is missing');
    }
    const revision = task.activeRevision;
    const numericParts = revision.numericParts.map((part) => ({
      key: part.partKey,
      labelLite: part.labelLite,
      correctValue: part.correctValue,
    }));
    const choices = revision.choices.map((choice) => ({
      key: choice.choiceKey,
      textLite: choice.contentLite,
    }));
    const sortedNumericParts = this.sortByKey(numericParts);
    const sortedChoices = this.sortByKey(choices);
    const correctKeys = revision.correctChoices.map((item) => item.choiceKey).sort();
    const correctAnswerJson =
      revision.answerType === TaskAnswerType.single_choice
        ? correctKeys[0]
          ? { key: correctKeys[0] }
          : null
        : revision.answerType === TaskAnswerType.multi_choice
          ? { keys: correctKeys }
          : null;

    return {
      id: task.id,
      unitId: task.unitId,
      title: task.title,
      statementLite: revision.statementLite,
      answerType: revision.answerType,
      numericPartsJson:
        revision.answerType === TaskAnswerType.numeric ? sortedNumericParts : null,
      choicesJson:
        revision.answerType === TaskAnswerType.single_choice ||
        revision.answerType === TaskAnswerType.multi_choice
          ? sortedChoices
          : null,
      correctAnswerJson,
      solutionLite: revision.solutionLite,
      isRequired: task.isRequired,
      status: task.status,
      sortOrder: task.sortOrder,
      createdAt: task.createdAt,
      updatedAt: task.updatedAt,
    };
  }

  private async nextTaskRevisionNo(tx: Prisma.TransactionClient, taskId: string) {
    const last = await tx.taskRevision.aggregate({
      where: { taskId },
      _max: { revisionNo: true },
    });
    return (last._max.revisionNo ?? 0) + 1;
  }

  private async createTaskRevision(
    tx: Prisma.TransactionClient,
    taskId: string,
    revisionNo: number,
    normalized: {
      answerType: TaskAnswerType;
      statementLite: string;
      numericPartsJson: NumericPart[] | null;
      choicesJson: Choice[] | null;
      correctAnswerJson: CorrectAnswer | null;
      solutionLite: string | null;
    },
  ) {
    const revision = await tx.taskRevision.create({
      data: {
        taskId,
        revisionNo,
        answerType: normalized.answerType,
        statementLite: normalized.statementLite,
        solutionLite: normalized.solutionLite,
      },
    });

    if (normalized.answerType === TaskAnswerType.numeric && normalized.numericPartsJson) {
      await tx.taskRevisionNumericPart.createMany({
        data: normalized.numericPartsJson.map((part) => ({
          taskRevisionId: revision.id,
          partKey: part.key,
          labelLite: part.labelLite ?? null,
          correctValue: part.correctValue,
        })),
      });
    }

    if (
      (normalized.answerType === TaskAnswerType.single_choice ||
        normalized.answerType === TaskAnswerType.multi_choice) &&
      normalized.choicesJson &&
      normalized.correctAnswerJson
    ) {
      await tx.taskRevisionChoice.createMany({
        data: normalized.choicesJson.map((choice) => ({
          taskRevisionId: revision.id,
          choiceKey: choice.key,
          contentLite: choice.textLite,
        })),
      });

      const correctKeys =
        normalized.answerType === TaskAnswerType.single_choice
          ? normalized.correctAnswerJson.key
            ? [normalized.correctAnswerJson.key]
            : []
          : normalized.correctAnswerJson.keys ?? [];

      if (correctKeys.length > 0) {
        await tx.taskRevisionCorrectChoice.createMany({
          data: correctKeys.map((key) => ({
            taskRevisionId: revision.id,
            choiceKey: key,
          })),
        });
      }
    }

    return revision;
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
    // Keep a generous limit; autosave should never allow unbounded payloads.
    if (trimmed.length > 200_000) throw new BadRequestException('InvalidRichText');
    return trimmed.length === 0 ? null : trimmed;
  }

  private sanitizeOptionalTitle(value: string | null | undefined): string | null {
    if (value === null || value === undefined) return null;
    if (typeof value !== 'string') throw new BadRequestException('InvalidTaskTitle');
    const trimmed = value.trim();
    if (trimmed.length === 0) return null;
    if (trimmed.length > 200) throw new BadRequestException('InvalidTaskTitle');
    return trimmed;
  }

  private sanitizeLiteText(
    value: unknown,
    options: { required: boolean; maxLength?: number; errorCode: string },
  ): string | null {
    const maxLength = options.maxLength ?? 20_000;
    if (value === null || value === undefined) {
      if (options.required) throw new BadRequestException(options.errorCode);
      return null;
    }
    if (typeof value !== 'string') throw new BadRequestException(options.errorCode);
    const trimmed = value.trim();
    if (options.required && trimmed.length === 0) throw new BadRequestException(options.errorCode);
    if (trimmed.length > maxLength) throw new BadRequestException(options.errorCode);
    return trimmed.length === 0 ? null : trimmed;
  }

  private normalizeAnswerType(value: unknown): TaskAnswerType {
    if (
      value !== TaskAnswerType.numeric &&
      value !== TaskAnswerType.single_choice &&
      value !== TaskAnswerType.multi_choice &&
      value !== TaskAnswerType.photo
    ) {
      throw new BadRequestException('InvalidAnswerType');
    }
    return value as TaskAnswerType;
  }

  private normalizeKey(value: unknown, errorCode: string): string {
    if (typeof value !== 'string') throw new BadRequestException(errorCode);
    const trimmed = value.trim();
    if (!trimmed) throw new BadRequestException(errorCode);
    if (!/^[a-zA-Z0-9_-]+$/.test(trimmed)) throw new BadRequestException(errorCode);
    return trimmed;
  }

  private normalizeNumericParts(value: unknown): NumericPart[] {
    if (!Array.isArray(value) || value.length === 0) {
      throw new BadRequestException('InvalidNumericParts');
    }

    const keys = new Set<string>();
    return value.map((item, index) => {
      if (!item || typeof item !== 'object') throw new BadRequestException('InvalidNumericParts');
      const part = item as Record<string, unknown>;
      const rawKey = typeof part.key === 'string' ? part.key : '';
      const normalizedKey = rawKey.trim() || String(index + 1);
      const key = this.normalizeKey(normalizedKey, 'InvalidNumericParts');
      if (keys.has(key)) throw new BadRequestException('InvalidNumericParts');
      keys.add(key);

      const labelLite = this.sanitizeLiteText(part.labelLite, {
        required: false,
        maxLength: 2000,
        errorCode: 'InvalidNumericParts',
      });
      const correctValue = this.sanitizeLiteText(part.correctValue, {
        required: true,
        maxLength: 2000,
        errorCode: 'InvalidNumericParts',
      });

      return { key, labelLite: labelLite ?? null, correctValue: correctValue ?? '' };
    });
  }

  private normalizeChoices(value: unknown): Choice[] {
    if (!Array.isArray(value) || value.length < 2) {
      throw new BadRequestException('InvalidChoices');
    }

    const keys = new Set<string>();
    return value.map((item, index) => {
      if (!item || typeof item !== 'object') throw new BadRequestException('InvalidChoices');
      const choice = item as Record<string, unknown>;
      const rawKey = typeof choice.key === 'string' ? choice.key : '';
      const normalizedKey = rawKey.trim() || String(index + 1);
      const key = this.normalizeKey(normalizedKey, 'InvalidChoices');
      if (keys.has(key)) throw new BadRequestException('InvalidChoices');
      keys.add(key);

      const textLite = this.sanitizeLiteText(choice.textLite, {
        required: true,
        maxLength: 2000,
        errorCode: 'InvalidChoices',
      });

      return { key, textLite: textLite ?? '' };
    });
  }

  private normalizeCorrectAnswerSingle(value: unknown, choiceKeys: Set<string>): CorrectAnswer {
    if (!value || typeof value !== 'object') throw new BadRequestException('InvalidCorrectAnswer');
    const v = value as Record<string, unknown>;
    const key = this.normalizeKey(v.key, 'InvalidCorrectAnswer');
    if (!choiceKeys.has(key)) throw new BadRequestException('InvalidCorrectAnswer');
    return { key };
  }

  private normalizeCorrectAnswerMulti(value: unknown, choiceKeys: Set<string>): CorrectAnswer {
    if (!value || typeof value !== 'object') throw new BadRequestException('InvalidCorrectAnswer');
    const v = value as Record<string, unknown>;
    if (!Array.isArray(v.keys) || v.keys.length === 0) {
      throw new BadRequestException('InvalidCorrectAnswer');
    }
    const unique = new Set<string>();
    const keys = v.keys.map((item) => {
      const key = this.normalizeKey(item, 'InvalidCorrectAnswer');
      if (!choiceKeys.has(key)) throw new BadRequestException('InvalidCorrectAnswer');
      unique.add(key);
      return key;
    });
    if (unique.size === 0) throw new BadRequestException('InvalidCorrectAnswer');
    return { keys: Array.from(unique) };
  }

  private normalizeTaskPayload(payload: {
    answerType: unknown;
    statementLite: unknown;
    numericPartsJson?: unknown;
    choicesJson?: unknown;
    correctAnswerJson?: unknown;
    solutionLite?: unknown;
  }): {
    answerType: TaskAnswerType;
    statementLite: string;
    numericPartsJson: NumericPart[] | null;
    choicesJson: Choice[] | null;
    correctAnswerJson: CorrectAnswer | null;
    solutionLite: string | null;
  } {
    const answerType = this.normalizeAnswerType(payload.answerType);
    const statementLite =
      this.sanitizeLiteText(payload.statementLite, {
        required: true,
        maxLength: 20_000,
        errorCode: 'InvalidStatementLite',
      }) ?? '';
    const solutionLite = this.sanitizeLiteText(payload.solutionLite, {
      required: false,
      maxLength: 20_000,
      errorCode: 'InvalidSolutionLite',
    });

    if (answerType === TaskAnswerType.numeric) {
      const numericParts = this.normalizeNumericParts(payload.numericPartsJson);
      return {
        answerType,
        statementLite,
        numericPartsJson: numericParts,
        choicesJson: null,
        correctAnswerJson: null,
        solutionLite,
      };
    }

    if (
      answerType === TaskAnswerType.single_choice ||
      answerType === TaskAnswerType.multi_choice
    ) {
      const choices = this.normalizeChoices(payload.choicesJson);
      const choiceKeys = new Set(choices.map((choice) => choice.key));
      const correctAnswer =
        answerType === TaskAnswerType.single_choice
          ? this.normalizeCorrectAnswerSingle(payload.correctAnswerJson, choiceKeys)
          : this.normalizeCorrectAnswerMulti(payload.correctAnswerJson, choiceKeys);
      return {
        answerType,
        statementLite,
        numericPartsJson: null,
        choicesJson: choices,
        correctAnswerJson: correctAnswer,
        solutionLite,
      };
    }

    if (payload.numericPartsJson !== null && payload.numericPartsJson !== undefined) {
      throw new BadRequestException('InvalidNumericParts');
    }
    if (payload.choicesJson !== null && payload.choicesJson !== undefined) {
      throw new BadRequestException('InvalidChoices');
    }
    if (payload.correctAnswerJson !== null && payload.correctAnswerJson !== undefined) {
      throw new BadRequestException('InvalidCorrectAnswer');
    }

    return {
      answerType,
      statementLite,
      numericPartsJson: null,
      choicesJson: null,
      correctAnswerJson: null,
      solutionLite,
    };
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
      // Title can be empty while the teacher is drafting the entry.
      if (title.length > 120) throw new BadRequestException('InvalidVideosJson');
      // URL can be empty while the teacher is drafting the entry.
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

  private async buildSectionGraph(
    sectionId: string,
    units: { id: string; title: string; status: ContentStatus; sortOrder: number }[],
  ): Promise<{ sectionId: string; nodes: GraphNode[]; edges: GraphEdge[] }> {
    const unitIds = units.map((unit) => unit.id);

    const [edges, layouts] = await Promise.all([
      this.prisma.unitGraphEdge.findMany({
        where: {
          sectionId,
          prereqUnitId: { in: unitIds },
          unitId: { in: unitIds },
        },
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.unitGraphLayout.findMany({
        where: { sectionId, unitId: { in: unitIds } },
      }),
    ]);

    const layoutByUnit = new Map(layouts.map((layout) => [layout.unitId, layout]));
    const defaultPositions = this.buildDefaultPositions(units);

    const nodes: GraphNode[] = units.map((unit) => {
      const layout = layoutByUnit.get(unit.id);
      const fallback = defaultPositions.get(unit.id) ?? { x: 0, y: 0 };
      return {
        unitId: unit.id,
        title: unit.title,
        status: unit.status,
        position: { x: layout?.x ?? fallback.x, y: layout?.y ?? fallback.y },
      };
    });

    const mappedEdges: GraphEdge[] = edges.map((edge) => ({
      id: edge.id,
      fromUnitId: edge.prereqUnitId,
      toUnitId: edge.unitId,
    }));

    return { sectionId, nodes, edges: mappedEdges };
  }

  private buildDefaultPositions(
    units: { id: string; sortOrder: number }[],
  ): Map<string, { x: number; y: number }> {
    const map = new Map<string, { x: number; y: number }>();
    const columns = 4;
    const stepX = 240;
    const stepY = 180;

    units.forEach((unit, index) => {
      const col = index % columns;
      const row = Math.floor(index / columns);
      map.set(unit.id, { x: col * stepX, y: row * stepY });
    });

    return map;
  }

  private hasGraphCycle(unitIds: Set<string>, edges: GraphUpdateEdge[]): boolean {
    const adjacency = new Map<string, string[]>();
    unitIds.forEach((id) => adjacency.set(id, []));
    edges.forEach((edge) => {
      const list = adjacency.get(edge.fromUnitId);
      if (list) list.push(edge.toUnitId);
    });

    const visiting = new Set<string>();
    const visited = new Set<string>();

    const dfs = (node: string): boolean => {
      if (visiting.has(node)) return true;
      if (visited.has(node)) return false;
      visiting.add(node);
      const neighbors = adjacency.get(node) ?? [];
      for (const next of neighbors) {
        if (dfs(next)) return true;
      }
      visiting.delete(node);
      visited.add(node);
      return false;
    };

    for (const id of unitIds) {
      if (dfs(id)) return true;
    }
    return false;
  }
}
