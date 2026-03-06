import { Role } from '@prisma/client';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EventsLogService } from '../../src/events/events-log.service';
import { ObjectStorageService } from '../../src/infra/storage/object-storage.service';
import { ContentService } from '../../src/content/content.service';
import { InternalLatexController } from '../../src/content/internal-latex.controller';
import { LatexCompileQueueService } from '../../src/content/latex-compile-queue.service';
import { TeacherLatexController } from '../../src/content/teacher-latex.controller';
import { UnitPdfPolicyService } from '../../src/content/unit-pdf-policy.service';
import { createIntegrationApp } from './test-app.factory';

describe('latex boundary integration', () => {
  let app: INestApplication;

  const contentService = {
    getUnit: vi.fn(),
    getTaskForSolutionPdfCompile: vi.fn(),
    updateTaskRevisionSolutionRichLatex: vi.fn(),
    getTaskSolutionRenderedState: vi.fn(),
    updateUnit: vi.fn(),
    setTaskRevisionSolutionRenderedAssets: vi.fn(),
  };
  const queueService = {
    enqueueUnitPdfCompile: vi.fn(),
    enqueueTaskSolutionPdfCompile: vi.fn(),
    getJob: vi.fn(),
  };
  const objectStorageService = {
    getPresignedGetUrl: vi.fn(),
    getObjectText: vi.fn(),
    presignGetObject: vi.fn(),
  };
  const eventsLogService = {
    append: vi.fn(),
  };

  beforeEach(async () => {
    Object.values(contentService).forEach((mockFn) => mockFn.mockReset());
    Object.values(queueService).forEach((mockFn) => mockFn.mockReset());
    Object.values(objectStorageService).forEach((mockFn) => mockFn.mockReset());
    eventsLogService.append.mockReset();

    contentService.getUnit.mockResolvedValue({
      id: 'unit-1',
      theoryPdfAssetKey: null,
      theoryHtmlAssetKey: null,
      methodPdfAssetKey: null,
      methodHtmlAssetKey: null,
    });
    contentService.getTaskForSolutionPdfCompile.mockResolvedValue({
      id: 'task-1',
      activeRevisionId: 'revision-1',
    });
    contentService.getTaskSolutionRenderedState.mockResolvedValue({
      taskId: 'task-1',
      activeRevisionId: 'revision-1',
      solutionHtmlAssetKey: null,
      solutionHtmlAssets: [],
    });
    queueService.enqueueUnitPdfCompile.mockResolvedValue('job-unit-1');
    queueService.enqueueTaskSolutionPdfCompile.mockResolvedValue('job-task-1');
    objectStorageService.getPresignedGetUrl.mockResolvedValue('https://storage.example/result.pdf');
    objectStorageService.getObjectText.mockResolvedValue(
      '<figure><img src="CONTINUUMTIKZPLACEHOLDER0" alt="" /></figure><p>Task solution</p>',
    );
    objectStorageService.presignGetObject.mockResolvedValue('https://storage.example/tikz-asset.svg');

    process.env.WORKER_INTERNAL_TOKEN = 'integration-token';

    app = await createIntegrationApp({
      controllers: [TeacherLatexController, InternalLatexController],
      providers: [
        { provide: ContentService, useValue: contentService },
        { provide: LatexCompileQueueService, useValue: queueService },
        { provide: ObjectStorageService, useValue: objectStorageService },
        { provide: EventsLogService, useValue: eventsLogService },
        UnitPdfPolicyService,
      ],
      constructorParams: [
        {
          target: TeacherLatexController,
          deps: [
            ContentService,
            LatexCompileQueueService,
            ObjectStorageService,
            UnitPdfPolicyService,
            EventsLogService,
          ],
        },
        {
          target: InternalLatexController,
          deps: [ContentService, LatexCompileQueueService, EventsLogService],
        },
      ],
      user: {
        id: 'teacher-1',
        login: 'teacher1',
        role: Role.teacher,
      },
    });
  });

  afterEach(async () => {
    delete process.env.WORKER_INTERNAL_TOKEN;
    await app.close();
  });

  it('accepts valid teacher compile requests and preserves exact request error codes', async () => {
    const validUnitResponse = await request(app.getHttpServer())
      .post('/teacher/units/unit-1/latex/compile')
      .send({ target: 'theory', tex: '\\\\text{Hello}', ttlSec: 600 });

    const validTaskResponse = await request(app.getHttpServer())
      .post('/teacher/tasks/task-1/solution/latex/compile')
      .send({ latex: '\\\\text{World}', ttlSec: 600 });

    const invalidTarget = await request(app.getHttpServer())
      .post('/teacher/units/unit-1/latex/compile')
      .send({ target: 'invalid', tex: '\\\\text{Hello}', ttlSec: 600 });

    const invalidTex = await request(app.getHttpServer())
      .post('/teacher/units/unit-1/latex/compile')
      .send({ target: 'theory', tex: '', ttlSec: 600 });

    const invalidTtl = await request(app.getHttpServer())
      .get('/teacher/latex/jobs/job-1')
      .query({ ttlSec: 0 });

    expect(validUnitResponse.status).toBe(202);
    expect(validUnitResponse.body).toEqual({ jobId: 'job-unit-1' });
    expect(queueService.enqueueUnitPdfCompile).toHaveBeenCalledWith({
      unitId: 'unit-1',
      target: 'theory',
      tex: '\\\\text{Hello}',
      requestedByUserId: 'teacher-1',
      requestedByRole: 'teacher',
      ttlSec: 600,
    });

    expect(validTaskResponse.status).toBe(202);
    expect(validTaskResponse.body).toEqual({ jobId: 'job-task-1' });
    expect(contentService.updateTaskRevisionSolutionRichLatex).toHaveBeenCalledWith('revision-1', '\\\\text{World}');

    expect(invalidTarget.status).toBe(400);
    expect(invalidTarget.body).toMatchObject({
      code: 'INVALID_PDF_TARGET',
      message: 'target must be one of: theory | method',
    });

    expect(invalidTex.status).toBe(400);
    expect(invalidTex.body).toMatchObject({
      code: 'INVALID_LATEX_INPUT',
      message: 'tex must be a non-empty string',
    });

    expect(invalidTtl.status).toBe(400);
    expect(invalidTtl.body).toMatchObject({
      code: 'INVALID_TTL',
      message: 'ttlSec must be a positive integer',
    });
  });

  it('parses compile job payload/result through shared boundary helpers for teacher endpoint', async () => {
    queueService.getJob.mockResolvedValue({
      id: 'job-1',
      data: {
        target: 'theory',
        unitId: 'unit-1',
        tex: '\\\\text{Hello}',
        requestedByUserId: 'teacher-1',
        requestedByRole: 'teacher',
        ttlSec: 600,
      },
      returnvalue: {
        target: 'theory',
        unitId: 'unit-1',
        assetKey: 'units/unit-1/theory/1710000000000-1234abcd.pdf',
        pdfAssetKey: 'units/unit-1/theory/1710000000000-1234abcd.pdf',
        htmlAssetKey: 'units/unit-1/theory/1710000000000-1234abcd.html',
        htmlAssets: [],
        sizeBytes: 1024,
      },
      failedReason: null,
      getState: vi.fn().mockResolvedValue('completed'),
    });

    const response = await request(app.getHttpServer())
      .get('/teacher/latex/jobs/job-1')
      .query({ ttlSec: 600 });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      jobId: 'job-1',
      status: 'succeeded',
      assetKey: 'units/unit-1/theory/1710000000000-1234abcd.pdf',
      presignedUrl: 'https://storage.example/result.pdf',
    });
  });

  it('applies compile result through internal endpoint using fallback job returnvalue', async () => {
    queueService.getJob.mockResolvedValue({
      id: 'job-1',
      data: {
        target: 'task_solution',
        taskId: 'task-1',
        taskRevisionId: 'revision-1',
        tex: '\\\\text{Hello}',
        requestedByUserId: 'teacher-1',
        requestedByRole: 'teacher',
        ttlSec: 600,
      },
      returnvalue: {
        target: 'task_solution',
        taskId: 'task-1',
        taskRevisionId: 'revision-1',
        assetKey: 'tasks/task-1/revisions/revision-1/solution/1710000000000-1234abcd.html',
        htmlAssets: [
          {
            placeholder: 'CONTINUUMTIKZPLACEHOLDER0',
            assetKey: 'rendering/tikz/asset-1.svg',
            contentType: 'image/svg+xml',
          },
        ],
        sizeBytes: 2048,
      },
      progress: {},
      getState: vi.fn().mockResolvedValue('completed'),
    });

    const response = await request(app.getHttpServer())
      .post('/internal/latex/jobs/job-1/apply')
      .set('x-internal-token', 'integration-token');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      ok: true,
      applied: true,
      jobId: 'job-1',
      taskId: 'task-1',
      taskRevisionId: 'revision-1',
      target: 'task_solution',
      assetKey: 'tasks/task-1/revisions/revision-1/solution/1710000000000-1234abcd.html',
    });
    expect(contentService.setTaskRevisionSolutionRenderedAssets).toHaveBeenCalledWith(
      'revision-1',
      'tasks/task-1/revisions/revision-1/solution/1710000000000-1234abcd.html',
      [
        {
          placeholder: 'CONTINUUMTIKZPLACEHOLDER0',
          assetKey: 'rendering/tikz/asset-1.svg',
          contentType: 'image/svg+xml',
        },
      ],
    );
  });

  it('returns teacher task solution rendered-content with signed asset URLs', async () => {
    contentService.getTaskSolutionRenderedState.mockResolvedValue({
      taskId: 'task-1',
      activeRevisionId: 'revision-1',
      solutionHtmlAssetKey: 'tasks/task-1/revisions/revision-1/solution/1710000000000-1234abcd.html',
      solutionHtmlAssets: [
        {
          placeholder: 'CONTINUUMTIKZPLACEHOLDER0',
          assetKey: 'rendering/tikz/asset-1.svg',
          contentType: 'image/svg+xml',
        },
      ],
    });

    const response = await request(app.getHttpServer())
      .get('/teacher/tasks/task-1/solution/rendered-content')
      .query({ ttlSec: 600 });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      ok: true,
      taskId: 'task-1',
      taskRevisionId: 'revision-1',
      html: '<figure><img src="https://storage.example/tikz-asset.svg" alt="" /></figure><p>Task solution</p>',
      htmlKey: 'tasks/task-1/revisions/revision-1/solution/1710000000000-1234abcd.html',
      expiresInSec: 600,
    });
    expect(objectStorageService.getObjectText).toHaveBeenCalledWith(
      'tasks/task-1/revisions/revision-1/solution/1710000000000-1234abcd.html',
    );
    expect(objectStorageService.presignGetObject).toHaveBeenCalledWith(
      'rendering/tikz/asset-1.svg',
      600,
      'image/svg+xml',
    );
  });
});
