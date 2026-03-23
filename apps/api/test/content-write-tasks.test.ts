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

import { ConflictException } from '@nestjs/common';
import { ContentWriteService } from '../src/content/content-write.service';

const normalizedTaskPayload = {
  answerType: 'numeric',
  statementLite: '2 + 2 = ?',
  methodGuidance: 'Вспомните базовое сложение.',
  numericPartsJson: [{ key: 'p1', labelLite: null, correctValue: '4' }],
  choicesJson: null,
  correctAnswerJson: null,
  statementImageAssetKey: null,
  solutionLite: 'Решение',
  solutionRichLatex: null,
  solutionPdfAssetKey: null,
  solutionHtmlAssetKey: null,
  solutionHtmlAssetsJson: null,
};

const createTransactionMock = () => ({
  task: {
    create: vi.fn(),
    update: vi.fn(),
  },
});

describe('ContentWriteService tasks slice', () => {
  const tx = createTransactionMock();
  const prisma = {
    unit: {
      findUnique: vi.fn(),
    },
    task: {
      findUnique: vi.fn(),
    },
    $transaction: vi.fn(),
  };
  const taskRevisionPayloadService = {
    normalizeTaskPayload: vi.fn(),
    createTaskRevision: vi.fn(),
    mapTaskWithRevision: vi.fn(),
    nextTaskRevisionNo: vi.fn(),
  };

  const service = new ContentWriteService(prisma as never, taskRevisionPayloadService as never);

  beforeEach(() => {
    prisma.unit.findUnique.mockReset();
    prisma.task.findUnique.mockReset();
    prisma.$transaction.mockReset();
    prisma.$transaction.mockImplementation(
      async (callback: (input: typeof tx) => Promise<unknown>) => callback(tx),
    );

    tx.task.create.mockReset();
    tx.task.update.mockReset();

    taskRevisionPayloadService.normalizeTaskPayload.mockReset();
    taskRevisionPayloadService.createTaskRevision.mockReset();
    taskRevisionPayloadService.mapTaskWithRevision.mockReset();
    taskRevisionPayloadService.nextTaskRevisionNo.mockReset();
  });

  it('creates task with initial revision and maps active revision payload', async () => {
    prisma.unit.findUnique.mockResolvedValue({ id: 'unit-1' });
    taskRevisionPayloadService.normalizeTaskPayload.mockReturnValue(normalizedTaskPayload);
    tx.task.create.mockResolvedValue({
      id: 'task-1',
      unitId: 'unit-1',
      title: null,
      isRequired: true,
      sortOrder: 3,
    });
    taskRevisionPayloadService.createTaskRevision.mockResolvedValue({
      id: 'revision-1',
      answerType: 'numeric',
      statementLite: '2 + 2 = ?',
      methodGuidance: 'Вспомните базовое сложение.',
      statementImageAssetKey: null,
      solutionLite: 'Решение',
      solutionRichLatex: null,
      solutionPdfAssetKey: null,
      solutionHtmlAssetKey: null,
      solutionHtmlAssetsJson: null,
    });
    tx.task.update.mockResolvedValue({
      id: 'task-1',
      unitId: 'unit-1',
      title: null,
      isRequired: true,
      status: 'draft',
      sortOrder: 3,
      createdAt: new Date('2026-03-02T00:00:00.000Z'),
      updatedAt: new Date('2026-03-02T00:00:00.000Z'),
      activeRevisionId: 'revision-1',
    });
    taskRevisionPayloadService.mapTaskWithRevision.mockReturnValue({ id: 'task-1', status: 'draft' });

    const result = await service.createTask({
      unitId: 'unit-1',
      answerType: 'numeric',
      statementLite: '2 + 2 = ?',
      methodGuidance: 'Вспомните базовое сложение.',
      numericPartsJson: [{ key: 'p1', labelLite: null, correctValue: '4' }],
      solutionLite: 'Решение',
      isRequired: true,
      sortOrder: 3,
    });

    expect(taskRevisionPayloadService.normalizeTaskPayload).toHaveBeenCalledWith(
      expect.objectContaining({
        statementImageAssetKey: null,
        methodGuidance: 'Вспомните базовое сложение.',
        solutionPdfAssetKey: null,
        solutionHtmlAssetKey: null,
        solutionHtmlAssetsJson: null,
      }),
    );
    expect(taskRevisionPayloadService.createTaskRevision).toHaveBeenCalledWith(
      tx,
      'task-1',
      1,
      normalizedTaskPayload,
    );
    expect(result).toEqual({ id: 'task-1', status: 'draft' });
  });

  it('updates task by creating next revision from merged current payload', async () => {
    prisma.task.findUnique.mockResolvedValue({
      id: 'task-1',
      unitId: 'unit-1',
      title: null,
      isRequired: false,
      status: 'draft',
      sortOrder: 1,
      createdAt: new Date('2026-03-01T00:00:00.000Z'),
      updatedAt: new Date('2026-03-01T00:00:00.000Z'),
      activeRevision: {
        id: 'revision-1',
        answerType: 'numeric',
        statementLite: 'old',
        statementImageAssetKey: 'tasks/task-1/revisions/revision-1/statement-image/file.png',
        solutionLite: 'old-solution',
        solutionRichLatex: null,
        solutionPdfAssetKey: 'tasks/task-1/revisions/revision-1/solution/file.pdf',
        numericParts: [],
        choices: [],
        correctChoices: [],
      },
    });
    taskRevisionPayloadService.mapTaskWithRevision
      .mockReturnValueOnce({
        id: 'task-1',
        unitId: 'unit-1',
        title: null,
        statementLite: 'old',
        methodGuidance: 'Старая подсказка',
        answerType: 'numeric',
        numericPartsJson: [{ key: 'old', labelLite: null, correctValue: '1' }],
        choicesJson: null,
        correctAnswerJson: null,
        statementImageAssetKey: 'tasks/task-1/revisions/revision-1/statement-image/file.png',
        solutionLite: 'old-solution',
        solutionRichLatex: null,
        solutionPdfAssetKey: 'tasks/task-1/revisions/revision-1/solution/file.pdf',
        solutionHtmlAssetKey: 'tasks/task-1/revisions/revision-1/solution/file.html',
        solutionHtmlAssetsJson: [
          {
            placeholder: 'CONTINUUMTIKZPLACEHOLDER0',
            assetKey: 'rendering/tikz/asset-1.svg',
            contentType: 'image/svg+xml',
          },
        ],
        isRequired: false,
        status: 'draft',
        sortOrder: 1,
        createdAt: new Date('2026-03-01T00:00:00.000Z'),
        updatedAt: new Date('2026-03-01T00:00:00.000Z'),
      })
      .mockReturnValueOnce({ id: 'task-1', status: 'published' });
    taskRevisionPayloadService.normalizeTaskPayload.mockReturnValue({
      ...normalizedTaskPayload,
      methodGuidance: 'Новая подсказка',
      statementImageAssetKey: 'tasks/task-1/revisions/revision-1/statement-image/file.png',
      solutionPdfAssetKey: 'tasks/task-1/revisions/revision-1/solution/file.pdf',
      solutionHtmlAssetKey: 'tasks/task-1/revisions/revision-1/solution/file.html',
      solutionHtmlAssetsJson: [
        {
          placeholder: 'CONTINUUMTIKZPLACEHOLDER0',
          assetKey: 'rendering/tikz/asset-1.svg',
          contentType: 'image/svg+xml',
        },
      ],
      solutionLite: 'new-solution',
    });
    taskRevisionPayloadService.nextTaskRevisionNo.mockResolvedValue(2);
    taskRevisionPayloadService.createTaskRevision.mockResolvedValue({
      id: 'revision-2',
      answerType: 'numeric',
      statementLite: 'new',
      methodGuidance: 'Новая подсказка',
      statementImageAssetKey: 'tasks/task-1/revisions/revision-1/statement-image/file.png',
      solutionLite: 'new-solution',
      solutionRichLatex: null,
      solutionPdfAssetKey: 'tasks/task-1/revisions/revision-1/solution/file.pdf',
      solutionHtmlAssetKey: 'tasks/task-1/revisions/revision-1/solution/file.html',
      solutionHtmlAssetsJson: [
        {
          placeholder: 'CONTINUUMTIKZPLACEHOLDER0',
          assetKey: 'rendering/tikz/asset-1.svg',
          contentType: 'image/svg+xml',
        },
      ],
    });
    tx.task.update.mockResolvedValue({
      id: 'task-1',
      unitId: 'unit-1',
      title: null,
      isRequired: true,
      status: 'published',
      sortOrder: 9,
      createdAt: new Date('2026-03-01T00:00:00.000Z'),
      updatedAt: new Date('2026-03-02T00:00:00.000Z'),
      activeRevisionId: 'revision-2',
    });

    const result = await service.updateTask('task-1', {
      statementLite: 'new',
      methodGuidance: 'Новая подсказка',
      numericPartsJson: [{ key: 'p1', labelLite: null, correctValue: '4' }],
      solutionLite: 'new-solution',
      isRequired: true,
      sortOrder: 9,
    });

    expect(taskRevisionPayloadService.normalizeTaskPayload).toHaveBeenCalledWith(
      expect.objectContaining({
        statementImageAssetKey: 'tasks/task-1/revisions/revision-1/statement-image/file.png',
        methodGuidance: 'Новая подсказка',
        solutionPdfAssetKey: 'tasks/task-1/revisions/revision-1/solution/file.pdf',
        solutionHtmlAssetKey: 'tasks/task-1/revisions/revision-1/solution/file.html',
        solutionHtmlAssetsJson: [
          {
            placeholder: 'CONTINUUMTIKZPLACEHOLDER0',
            assetKey: 'rendering/tikz/asset-1.svg',
            contentType: 'image/svg+xml',
          },
        ],
      }),
    );
    expect(taskRevisionPayloadService.nextTaskRevisionNo).toHaveBeenCalledWith(tx, 'task-1');
    expect(taskRevisionPayloadService.createTaskRevision).toHaveBeenCalledWith(
      tx,
      'task-1',
      2,
      expect.objectContaining({
        statementImageAssetKey: 'tasks/task-1/revisions/revision-1/statement-image/file.png',
      }),
    );
    expect(result).toEqual({ id: 'task-1', status: 'published' });
  });

  it('rejects publishing a task while parent unit is draft', async () => {
    prisma.task.findUnique.mockResolvedValue({
      id: 'task-1',
      unit: { id: 'unit-1', status: 'draft' },
    });

    await expect(service.publishTask('task-1')).rejects.toBeInstanceOf(ConflictException);
  });
});
