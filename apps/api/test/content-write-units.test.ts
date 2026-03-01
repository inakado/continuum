import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@prisma/client', () => ({
  ContentStatus: {
    draft: 'draft',
    published: 'published',
  },
  Prisma: {
    DbNull: Symbol('DbNull'),
  },
  PrismaClient: class PrismaClient {},
  TaskAnswerType: {
    numeric: 'numeric',
    single_choice: 'single_choice',
    multi_choice: 'multi_choice',
    text: 'text',
  },
}));

import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { ContentWriteService } from '../src/content/content-write.service';

const taskRevisionPayloadService = {
  normalizeTaskPayload: vi.fn(),
  createTaskRevision: vi.fn(),
  mapTaskWithRevision: vi.fn(),
  nextTaskRevisionNo: vi.fn(),
};

const createTransactionMock = () => ({
  unit: {
    findUnique: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  task: {
    findMany: vi.fn(),
    updateMany: vi.fn(),
  },
  unitGraphEdge: {
    deleteMany: vi.fn(),
  },
  unitGraphLayout: {
    deleteMany: vi.fn(),
  },
});

describe('ContentWriteService units slice', () => {
  const tx = createTransactionMock();
  const prisma = {
    section: {
      findUnique: vi.fn(),
    },
    unit: {
      findUnique: vi.fn(),
    },
    task: {
      count: vi.fn(),
    },
    $transaction: vi.fn(),
  };

  const service = new ContentWriteService(prisma as never, taskRevisionPayloadService as never);

  beforeEach(() => {
    prisma.section.findUnique.mockReset();
    prisma.unit.findUnique.mockReset();
    prisma.task.count.mockReset();
    prisma.$transaction.mockReset();
    prisma.$transaction.mockImplementation(
      async (callback: (input: typeof tx) => Promise<unknown>) => callback(tx),
    );

    tx.unit.findUnique.mockReset();
    tx.unit.update.mockReset();
    tx.unit.delete.mockReset();
    tx.task.findMany.mockReset();
    tx.task.updateMany.mockReset();
    tx.unitGraphEdge.deleteMany.mockReset();
    tx.unitGraphLayout.deleteMany.mockReset();
  });

  it('creates unit only when parent section exists', async () => {
    prisma.section.findUnique.mockResolvedValue(null);

    await expect(
      service.createUnit({ sectionId: 'section-1', title: 'Производная' }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('updates unit metadata and required task flags inside one transaction', async () => {
    tx.unit.findUnique.mockResolvedValue({ id: 'unit-1' });
    tx.task.findMany.mockResolvedValue([{ id: 'task-1', unitId: 'unit-1' }]);
    tx.unit.update.mockResolvedValue({
      id: 'unit-1',
      title: 'Пределы',
      theoryRichLatex: 'Теория',
      methodPdfAssetKey: 'assets/method.pdf',
    });

    const result = await service.updateUnit('unit-1', {
      title: 'Пределы',
      minOptionalCountedTasksToComplete: 1,
      requiredTaskIds: ['task-1'],
      theoryRichLatex: '  Теория  ',
      methodPdfAssetKey: ' assets/method.pdf ',
      videosJson: [{ id: 'video-1', title: 'Введение', embedUrl: 'https://video.example/embed/1' }],
      attachmentsJson: [{ id: 'att-1', name: 'Конспект', urlOrKey: 'docs/guide.pdf' }],
    });

    expect(result).toEqual({
      id: 'unit-1',
      title: 'Пределы',
      theoryRichLatex: 'Теория',
      methodPdfAssetKey: 'assets/method.pdf',
    });
    expect(tx.unit.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'unit-1' },
        data: expect.objectContaining({
          title: 'Пределы',
          minOptionalCountedTasksToComplete: 1,
          theoryRichLatex: 'Теория',
          methodPdfAssetKey: 'assets/method.pdf',
          videosJson: [
            {
              id: 'video-1',
              title: 'Введение',
              embedUrl: 'https://video.example/embed/1',
            },
          ],
          attachmentsJson: [
            {
              id: 'att-1',
              name: 'Конспект',
              urlOrKey: 'docs/guide.pdf',
            },
          ],
        }),
      }),
    );
    expect(tx.task.updateMany).toHaveBeenNthCalledWith(1, {
      where: { unitId: 'unit-1', isRequired: true },
      data: { isRequired: false },
    });
    expect(tx.task.updateMany).toHaveBeenNthCalledWith(2, {
      where: { unitId: 'unit-1', id: { in: ['task-1'] } },
      data: { isRequired: true },
    });
  });

  it('rejects invalid required task ids before persisting unit update', async () => {
    await expect(
      service.updateUnit('unit-1', {
        requiredTaskIds: ['task-1', 'task-1'],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('deletes graph edges and layout before removing unit', async () => {
    prisma.unit.findUnique.mockResolvedValue({ id: 'unit-1', sectionId: 'section-1' });
    prisma.task.count.mockResolvedValue(0);
    tx.unit.delete.mockResolvedValue({ id: 'unit-1' });

    const result = await service.deleteUnit('unit-1');

    expect(tx.unitGraphEdge.deleteMany).toHaveBeenCalledWith({
      where: {
        sectionId: 'section-1',
        OR: [{ prereqUnitId: 'unit-1' }, { unitId: 'unit-1' }],
      },
    });
    expect(tx.unitGraphLayout.deleteMany).toHaveBeenCalledWith({
      where: { sectionId: 'section-1', unitId: 'unit-1' },
    });
    expect(result).toEqual({ id: 'unit-1' });
  });

  it('rejects publishing a unit while parent section is draft', async () => {
    prisma.unit.findUnique.mockResolvedValue({
      id: 'unit-1',
      section: { id: 'section-1', status: 'draft' },
    });

    await expect(service.publishUnit('unit-1')).rejects.toBeInstanceOf(ConflictException);
  });
});
