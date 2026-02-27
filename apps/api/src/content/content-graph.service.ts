import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { ContentStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export type GraphNode = {
  unitId: string;
  title: string;
  status: ContentStatus;
  createdAt: Date;
  position: { x: number; y: number };
};

export type GraphEdge = {
  id: string;
  fromUnitId: string;
  toUnitId: string;
};

export type GraphUpdateNode = {
  unitId: string;
  position: { x: number; y: number };
};

export type GraphUpdateEdge = {
  fromUnitId: string;
  toUnitId: string;
};

@Injectable()
export class ContentGraphService {
  constructor(private readonly prisma: PrismaService) {}

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

  async updateSectionGraph(sectionId: string, nodes: GraphUpdateNode[], edges: GraphUpdateEdge[]) {
    const section = await this.prisma.section.findUnique({
      where: { id: sectionId },
      select: { id: true },
    });
    if (!section) {
      throw new NotFoundException({
        code: 'SECTION_NOT_FOUND',
        message: 'Section not found',
      });
    }

    const units = await this.prisma.unit.findMany({
      where: { sectionId },
      select: { id: true },
    });
    const unitIdSet = new Set(units.map((unit) => unit.id));

    for (const node of nodes) {
      if (!unitIdSet.has(node.unitId)) {
        throw new NotFoundException({
          code: 'UNIT_NOT_IN_SECTION',
          message: 'Unit not found in section',
        });
      }
    }

    const edgeKeySet = new Set<string>();
    for (const edge of edges) {
      if (!unitIdSet.has(edge.fromUnitId) || !unitIdSet.has(edge.toUnitId)) {
        throw new NotFoundException({
          code: 'UNIT_NOT_IN_SECTION',
          message: 'Unit not found in section',
        });
      }
      if (edge.fromUnitId === edge.toUnitId) {
        throw new ConflictException({
          code: 'GRAPH_SELF_LOOP_NOT_ALLOWED',
          message: 'Graph self-loop is not allowed',
        });
      }
      const key = `${edge.fromUnitId}:${edge.toUnitId}`;
      if (edgeKeySet.has(key)) {
        throw new ConflictException({
          code: 'GRAPH_DUPLICATE_EDGE_NOT_ALLOWED',
          message: 'Duplicate graph edge is not allowed',
        });
      }
      edgeKeySet.add(key);
    }

    if (this.hasGraphCycle(unitIdSet, edges)) {
      throw new ConflictException({
        code: 'GRAPH_CYCLE_NOT_ALLOWED',
        message: 'Graph cycle is not allowed',
      });
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

  private async buildSectionGraph(
    sectionId: string,
    units: { id: string; title: string; status: ContentStatus; sortOrder: number; createdAt: Date }[],
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
        createdAt: unit.createdAt,
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
