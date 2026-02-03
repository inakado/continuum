import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { ContentStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCourseDto, UpdateCourseDto } from './dto/course.dto';
import { CreateSectionDto, UpdateSectionDto } from './dto/section.dto';
import { CreateUnitDto, UpdateUnitDto } from './dto/unit.dto';
import { CreateTaskDto, UpdateTaskDto } from './dto/task.dto';

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

    const data: { title?: string; sortOrder?: number } = {};
    if (dto.title !== undefined) data.title = dto.title;
    if (dto.sortOrder !== undefined) data.sortOrder = dto.sortOrder;

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

    return this.prisma.task.create({
      data: {
        unitId: dto.unitId,
        title: dto.title ?? null,
        statementLite: dto.statementLite,
        answerType: dto.answerType,
        isRequired: dto.isRequired ?? false,
        sortOrder: dto.sortOrder ?? 0,
      },
    });
  }

  async updateTask(id: string, dto: UpdateTaskDto) {
    const exists = await this.prisma.task.findUnique({ where: { id } });
    if (!exists) throw new NotFoundException('Task not found');

    const data: {
      title?: string | null;
      statementLite?: string;
      answerType?: string;
      isRequired?: boolean;
      sortOrder?: number;
    } = {};

    if (dto.title !== undefined) data.title = dto.title;
    if (dto.statementLite !== undefined) data.statementLite = dto.statementLite;
    if (dto.answerType !== undefined) data.answerType = dto.answerType;
    if (dto.isRequired !== undefined) data.isRequired = dto.isRequired;
    if (dto.sortOrder !== undefined) data.sortOrder = dto.sortOrder;

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
