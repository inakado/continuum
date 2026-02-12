import { Injectable, NotFoundException } from '@nestjs/common';
import { ContentStatus, Prisma, StudentTaskStatus, StudentUnitStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

type DbClient = PrismaService | Prisma.TransactionClient;

type PublishedUnit = {
  id: string;
  sortOrder: number;
  minCountedTasksToComplete: number;
};

type PublishedTask = {
  id: string;
  unitId: string;
  isRequired: boolean;
};

type ExistingUnitState = {
  unitId: string;
  overrideOpened: boolean;
  becameAvailableAt: Date | null;
  startedAt: Date | null;
  completedAt: Date | null;
};

type SectionComputationContext = {
  units: PublishedUnit[];
  edges: { prereqUnitId: string; unitId: string }[];
  tasks: PublishedTask[];
  taskStates: { taskId: string; status: StudentTaskStatus }[];
  attemptedTaskIds: Set<string>;
  existingStatesByUnitId: Map<string, ExistingUnitState>;
};

export type UnitProgressSnapshot = {
  unitId: string;
  status: StudentUnitStatus;
  totalTasks: number;
  countedTasks: number;
  solvedTasks: number;
  completionPercent: number;
  solvedPercent: number;
  hasAttempt: boolean;
  isCompleted: boolean;
  requiredTasksCount: number;
  effectiveMinCountedTasksToComplete: number;
};

const COUNTED_STATUSES = new Set<StudentTaskStatus>([
  StudentTaskStatus.correct,
  StudentTaskStatus.credited_without_progress,
  StudentTaskStatus.teacher_credited,
]);

const SOLVED_STATUSES = new Set<StudentTaskStatus>([
  StudentTaskStatus.correct,
  StudentTaskStatus.teacher_credited,
]);

@Injectable()
export class LearningAvailabilityService {
  constructor(private readonly prisma: PrismaService) {}

  async computeUnitMetrics(
    studentId: string,
    unitId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<{
    totalTasks: number;
    countedTasks: number;
    solvedTasks: number;
    completionPercent: number;
    solvedPercent: number;
  }> {
    const snapshot = await this.getUnitSnapshot(studentId, unitId, tx);
    return {
      totalTasks: snapshot.totalTasks,
      countedTasks: snapshot.countedTasks,
      solvedTasks: snapshot.solvedTasks,
      completionPercent: snapshot.completionPercent,
      solvedPercent: snapshot.solvedPercent,
    };
  }

  async computeUnitCompleted(
    studentId: string,
    unitId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<boolean> {
    const snapshot = await this.getUnitSnapshot(studentId, unitId, tx);
    return snapshot.isCompleted;
  }

  async computeUnitStatus(
    studentId: string,
    unitId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<StudentUnitStatus> {
    const snapshot = await this.getUnitSnapshot(studentId, unitId, tx);
    return snapshot.status;
  }

  async recomputeSectionAvailability(
    studentId: string,
    sectionId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<Map<string, UnitProgressSnapshot>> {
    const db = tx ?? this.prisma;
    const context = await this.loadSectionComputationContext(db, studentId, sectionId);
    const snapshots = this.computeSnapshots(context);
    await this.persistSnapshots(db, studentId, snapshots, context.existingStatesByUnitId);
    return snapshots;
  }

  private async getUnitSnapshot(
    studentId: string,
    unitId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<UnitProgressSnapshot> {
    const db = tx ?? this.prisma;
    const unit = await db.unit.findFirst({
      where: {
        id: unitId,
        status: ContentStatus.published,
        section: {
          status: ContentStatus.published,
          course: { status: ContentStatus.published },
        },
      },
      select: { id: true, sectionId: true },
    });

    if (!unit) throw new NotFoundException('Unit not found');

    const snapshots = await this.recomputeSectionAvailability(studentId, unit.sectionId, tx);
    const snapshot = snapshots.get(unit.id);
    if (!snapshot) throw new NotFoundException('Unit not found');
    return snapshot;
  }

  private async loadSectionComputationContext(
    db: DbClient,
    studentId: string,
    sectionId: string,
  ): Promise<SectionComputationContext> {
    const section = await db.section.findFirst({
      where: {
        id: sectionId,
        status: ContentStatus.published,
        course: { status: ContentStatus.published },
      },
      select: {
        units: {
          where: { status: ContentStatus.published },
          orderBy: { sortOrder: 'asc' },
          select: {
            id: true,
            sortOrder: true,
            minCountedTasksToComplete: true,
          },
        },
      },
    });

    if (!section) throw new NotFoundException('Section not found');

    const unitIds = section.units.map((unit) => unit.id);
    if (unitIds.length === 0) {
      return {
        units: [],
        edges: [],
        tasks: [],
        taskStates: [],
        attemptedTaskIds: new Set(),
        existingStatesByUnitId: new Map(),
      };
    }

    const [edges, tasks, existingStates] = await Promise.all([
      db.unitGraphEdge.findMany({
        where: {
          sectionId,
          prereqUnitId: { in: unitIds },
          unitId: { in: unitIds },
        },
        select: { prereqUnitId: true, unitId: true },
      }),
      db.task.findMany({
        where: { unitId: { in: unitIds }, status: ContentStatus.published },
        select: { id: true, unitId: true, isRequired: true },
      }),
      db.studentUnitState.findMany({
        where: { studentId, unitId: { in: unitIds } },
        select: {
          unitId: true,
          overrideOpened: true,
          becameAvailableAt: true,
          startedAt: true,
          completedAt: true,
        },
      }),
    ]);

    const taskIds = tasks.map((task) => task.id);
    let taskStates: { taskId: string; status: StudentTaskStatus }[] = [];
    let attempts: { taskId: string }[] = [];
    if (taskIds.length > 0) {
      [taskStates, attempts] = await Promise.all([
        db.studentTaskState.findMany({
          where: { studentId, taskId: { in: taskIds } },
          select: { taskId: true, status: true },
        }),
        db.attempt.findMany({
          where: { studentId, taskId: { in: taskIds } },
          select: { taskId: true },
          distinct: ['taskId'],
        }),
      ]);
    }

    return {
      units: section.units,
      edges,
      tasks,
      taskStates,
      attemptedTaskIds: new Set(attempts.map((attempt) => attempt.taskId)),
      existingStatesByUnitId: new Map(existingStates.map((state) => [state.unitId, state])),
    };
  }

  private computeSnapshots(context: SectionComputationContext): Map<string, UnitProgressSnapshot> {
    const tasksByUnitId = new Map<string, PublishedTask[]>();
    for (const task of context.tasks) {
      const list = tasksByUnitId.get(task.unitId) ?? [];
      list.push(task);
      tasksByUnitId.set(task.unitId, list);
    }

    const taskStatusByTaskId = new Map(context.taskStates.map((state) => [state.taskId, state.status]));

    const hasAttemptByUnitId = new Map<string, boolean>();
    for (const unit of context.units) {
      const tasks = tasksByUnitId.get(unit.id) ?? [];
      hasAttemptByUnitId.set(
        unit.id,
        tasks.some((task) => context.attemptedTaskIds.has(task.id)),
      );
    }

    const prereqByUnitId = new Map<string, string[]>();
    for (const unit of context.units) {
      prereqByUnitId.set(unit.id, []);
    }
    for (const edge of context.edges) {
      const list = prereqByUnitId.get(edge.unitId);
      if (list) list.push(edge.prereqUnitId);
    }

    const orderedUnitIds = this.sortUnitIdsTopologically(context.units, context.edges);
    const snapshots = new Map<string, UnitProgressSnapshot>();

    for (const unitId of orderedUnitIds) {
      const unit = context.units.find((item) => item.id === unitId);
      if (!unit) continue;

      const unitTasks = tasksByUnitId.get(unitId) ?? [];
      const totalTasks = unitTasks.length;
      let countedTasks = 0;
      let solvedTasks = 0;
      let requiredCountedTasks = 0;
      let requiredTasksCount = 0;

      for (const task of unitTasks) {
        const taskStatus = taskStatusByTaskId.get(task.id);
        const isCounted = Boolean(taskStatus && COUNTED_STATUSES.has(taskStatus));
        const isSolved = Boolean(taskStatus && SOLVED_STATUSES.has(taskStatus));

        if (isCounted) countedTasks += 1;
        if (isSolved) solvedTasks += 1;

        if (task.isRequired) {
          requiredTasksCount += 1;
          if (isCounted) requiredCountedTasks += 1;
        }
      }

      const completionPercent =
        totalTasks === 0 ? 0 : Math.floor((countedTasks * 100) / totalTasks);
      const solvedPercent = totalTasks === 0 ? 0 : Math.floor((solvedTasks * 100) / totalTasks);

      const effectiveMinCountedTasksToComplete = Math.max(
        unit.minCountedTasksToComplete,
        requiredTasksCount,
      );
      const requiredGateSatisfied = requiredCountedTasks === requiredTasksCount;
      const isCompleted =
        requiredGateSatisfied && countedTasks >= effectiveMinCountedTasksToComplete;

      const prereqIds = prereqByUnitId.get(unitId) ?? [];
      const prereqsCompleted = prereqIds.every(
        (prereqId) => snapshots.get(prereqId)?.status === StudentUnitStatus.completed,
      );

      const hasAttempt = hasAttemptByUnitId.get(unitId) ?? false;

      const status = isCompleted
        ? StudentUnitStatus.completed
        : prereqsCompleted
          ? hasAttempt
            ? StudentUnitStatus.in_progress
            : StudentUnitStatus.available
          : StudentUnitStatus.locked;

      snapshots.set(unitId, {
        unitId,
        status,
        totalTasks,
        countedTasks,
        solvedTasks,
        completionPercent,
        solvedPercent,
        hasAttempt,
        isCompleted,
        requiredTasksCount,
        effectiveMinCountedTasksToComplete,
      });
    }

    return snapshots;
  }

  private async persistSnapshots(
    db: DbClient,
    studentId: string,
    snapshots: Map<string, UnitProgressSnapshot>,
    existingStatesByUnitId: Map<string, ExistingUnitState>,
  ) {
    const now = new Date();

    for (const snapshot of snapshots.values()) {
      const existing = existingStatesByUnitId.get(snapshot.unitId);
      const isUnlocked = snapshot.status !== StudentUnitStatus.locked;

      const becameAvailableAt = existing?.becameAvailableAt ?? (isUnlocked ? now : null);
      const startedAt = existing?.startedAt ?? (snapshot.hasAttempt ? now : null);
      const completedAt =
        snapshot.status === StudentUnitStatus.completed ? (existing?.completedAt ?? now) : null;

      await db.studentUnitState.upsert({
        where: {
          studentId_unitId: {
            studentId,
            unitId: snapshot.unitId,
          },
        },
        create: {
          studentId,
          unitId: snapshot.unitId,
          status: snapshot.status,
          overrideOpened: existing?.overrideOpened ?? false,
          countedTasks: snapshot.countedTasks,
          solvedTasks: snapshot.solvedTasks,
          totalTasks: snapshot.totalTasks,
          completionPercent: snapshot.completionPercent,
          solvedPercent: snapshot.solvedPercent,
          becameAvailableAt,
          startedAt,
          completedAt,
          updatedAt: now,
        },
        update: {
          status: snapshot.status,
          overrideOpened: existing?.overrideOpened ?? false,
          countedTasks: snapshot.countedTasks,
          solvedTasks: snapshot.solvedTasks,
          totalTasks: snapshot.totalTasks,
          completionPercent: snapshot.completionPercent,
          solvedPercent: snapshot.solvedPercent,
          becameAvailableAt,
          startedAt,
          completedAt,
          updatedAt: now,
        },
      });
    }
  }

  private sortUnitIdsTopologically(
    units: PublishedUnit[],
    edges: { prereqUnitId: string; unitId: string }[],
  ): string[] {
    const unitIds = units.map((unit) => unit.id);
    const unitIdSet = new Set(unitIds);
    const sortOrderByUnitId = new Map(units.map((unit) => [unit.id, unit.sortOrder]));

    const indegree = new Map<string, number>();
    const adjacency = new Map<string, string[]>();

    for (const unitId of unitIds) {
      indegree.set(unitId, 0);
      adjacency.set(unitId, []);
    }

    for (const edge of edges) {
      if (!unitIdSet.has(edge.prereqUnitId) || !unitIdSet.has(edge.unitId)) continue;
      indegree.set(edge.unitId, (indegree.get(edge.unitId) ?? 0) + 1);
      const list = adjacency.get(edge.prereqUnitId);
      if (list) list.push(edge.unitId);
    }

    const bySortOrder = (a: string, b: string) => {
      const sortDiff = (sortOrderByUnitId.get(a) ?? 0) - (sortOrderByUnitId.get(b) ?? 0);
      if (sortDiff !== 0) return sortDiff;
      return a.localeCompare(b);
    };

    const queue = unitIds.filter((unitId) => (indegree.get(unitId) ?? 0) === 0).sort(bySortOrder);
    const ordered: string[] = [];

    while (queue.length > 0) {
      const current = queue.shift();
      if (!current) continue;
      ordered.push(current);

      const neighbors = adjacency.get(current) ?? [];
      for (const neighbor of neighbors) {
        const nextDegree = (indegree.get(neighbor) ?? 0) - 1;
        indegree.set(neighbor, nextDegree);
        if (nextDegree === 0) {
          queue.push(neighbor);
        }
      }
      queue.sort(bySortOrder);
    }

    if (ordered.length === unitIds.length) return ordered;

    const unresolved = unitIds.filter((unitId) => !ordered.includes(unitId)).sort(bySortOrder);
    return [...ordered, ...unresolved];
  }
}
