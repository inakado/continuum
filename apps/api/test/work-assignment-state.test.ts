import 'reflect-metadata';
import { expect, it, vi } from 'vitest';
import { AssessmentWorksReadService } from '../src/assessment-works/assessment-works-read.service';
import type { PrismaService } from '../src/prisma/prisma.service';

it('projects assignment presence independently of editing revisions and archive state', async () => {
  const base = { title: 'Кинематика', gradeBand: 'grade_10_11', taskCount: 30, maxPoints: 45, updatedAt: new Date('2026-10-29T00:00:00Z'), lifecycleRevision: 1 };
  const rows = [
    { ...base, id: 'new', revision: 1, archivedAt: null, _count: { versions: 0 } },
    { ...base, id: 'edited-unassigned', revision: 8, archivedAt: null, _count: { versions: 0 } },
    { ...base, id: 'assigned', revision: 3, archivedAt: null, _count: { versions: 1 } },
    { ...base, id: 'archived-assigned', revision: 10, archivedAt: new Date(), _count: { versions: 2 } },
  ];
  const db = { assessmentWork: { findMany: vi.fn().mockResolvedValue(rows) } };
  const service = new AssessmentWorksReadService(db as unknown as PrismaService);
  const result = await service.list('teacher');
  expect(result.map(({ id, hasAssignments, isArchived, canDelete }) => ({ id, hasAssignments, isArchived, canDelete }))).toEqual([
    { id: 'new', hasAssignments: false, isArchived: false, canDelete: true },
    { id: 'edited-unassigned', hasAssignments: false, isArchived: false, canDelete: true },
    { id: 'assigned', hasAssignments: true, isArchived: false, canDelete: false },
    { id: 'archived-assigned', hasAssignments: true, isArchived: true, canDelete: false },
  ]);
  expect(db.assessmentWork.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { teacherId: 'teacher', deletedAt: null } }));
});
