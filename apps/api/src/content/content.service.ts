import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ContentStatus } from '@prisma/client';
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
type TaskAnswerType = 'numeric' | 'single_choice' | 'multi_choice' | 'photo';

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
      include: { tasks: { orderBy: { sortOrder: 'asc' } } },
    });
    if (!unit) throw new NotFoundException('Unit not found');
    return unit;
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
        },
      },
    });
    if (!unit) throw new NotFoundException('Unit not found');
    return unit;
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
    const exists = await this.prisma.unit.findUnique({ where: { id } });
    if (!exists) throw new NotFoundException('Unit not found');

    const data: {
      title?: string;
      description?: string | null;
      sortOrder?: number;
      theoryRichLatex?: string | null;
      methodRichLatex?: string | null;
      videosJson?: UnitVideo[] | null;
      attachmentsJson?: UnitAttachment[] | null;
    } = {};
    if (dto.title !== undefined) data.title = dto.title;
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.sortOrder !== undefined) data.sortOrder = dto.sortOrder;
    if (dto.theoryRichLatex !== undefined) {
      data.theoryRichLatex = this.sanitizeRichText(dto.theoryRichLatex);
    }
    if (dto.methodRichLatex !== undefined) {
      data.methodRichLatex = this.sanitizeRichText(dto.methodRichLatex);
    }
    if (dto.videosJson !== undefined) {
      data.videosJson = this.validateVideosJson(dto.videosJson);
    }
    if (dto.attachmentsJson !== undefined) {
      data.attachmentsJson = this.validateAttachmentsJson(dto.attachmentsJson);
    }

    return this.prisma.unit.update({ where: { id }, data });
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
    const task = await this.prisma.task.findUnique({ where: { id } });
    if (!task) throw new NotFoundException('Task not found');
    return task;
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

    return this.prisma.task.create({
      data: {
        unitId: dto.unitId,
        title: null,
        statementLite: normalized.statementLite,
        answerType: normalized.answerType,
        numericPartsJson: normalized.numericPartsJson,
        choicesJson: normalized.choicesJson,
        correctAnswerJson: normalized.correctAnswerJson,
        solutionLite: normalized.solutionLite,
        isRequired: dto.isRequired ?? false,
        sortOrder: dto.sortOrder ?? 0,
      },
    });
  }

  async updateTask(id: string, dto: UpdateTaskDto) {
    const current = await this.prisma.task.findUnique({ where: { id } });
    if (!current) throw new NotFoundException('Task not found');

    const merged = {
      title: null,
      statementLite: dto.statementLite ?? current.statementLite,
      answerType: dto.answerType ?? current.answerType,
      numericPartsJson:
        dto.numericPartsJson !== undefined ? dto.numericPartsJson : current.numericPartsJson,
      choicesJson: dto.choicesJson !== undefined ? dto.choicesJson : current.choicesJson,
      correctAnswerJson:
        dto.correctAnswerJson !== undefined ? dto.correctAnswerJson : current.correctAnswerJson,
      solutionLite: dto.solutionLite !== undefined ? dto.solutionLite : current.solutionLite,
      isRequired: dto.isRequired ?? current.isRequired,
      sortOrder: dto.sortOrder ?? current.sortOrder,
    };

    const normalized = this.normalizeTaskPayload({
      answerType: merged.answerType,
      statementLite: merged.statementLite,
      numericPartsJson: merged.numericPartsJson,
      choicesJson: merged.choicesJson,
      correctAnswerJson: merged.correctAnswerJson,
      solutionLite: merged.solutionLite ?? null,
    });

    const data = {
      title: null,
      statementLite: normalized.statementLite,
      answerType: normalized.answerType,
      numericPartsJson: normalized.numericPartsJson,
      choicesJson: normalized.choicesJson,
      correctAnswerJson: normalized.correctAnswerJson,
      solutionLite: normalized.solutionLite,
      isRequired: merged.isRequired,
      sortOrder: merged.sortOrder,
    };

    return this.prisma.task.update({ where: { id }, data });
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
    if (value !== 'numeric' && value !== 'single_choice' && value !== 'multi_choice' && value !== 'photo') {
      throw new BadRequestException('InvalidAnswerType');
    }
    return value;
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

    if (answerType === 'numeric') {
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

    if (answerType === 'single_choice' || answerType === 'multi_choice') {
      const choices = this.normalizeChoices(payload.choicesJson);
      const choiceKeys = new Set(choices.map((choice) => choice.key));
      const correctAnswer =
        answerType === 'single_choice'
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
