import { ConflictException } from '@nestjs/common';
import { Role } from '@prisma/client';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { UnitPdfPolicyService } from '../../src/content/unit-pdf-policy.service';
import { ObjectStorageService } from '../../src/infra/storage/object-storage.service';
import { LearningService } from '../../src/learning/learning.service';
import { StudentTaskSolutionsController } from '../../src/learning/student-task-solutions.controller';
import { createIntegrationApp } from './test-app.factory';

describe('student task solution rendered-content integration', () => {
  let app: INestApplication;

  const learningService = {
    getTaskSolutionRenderedAssetStateForStudent: vi.fn(),
  };
  const objectStorageService = {
    getObjectText: vi.fn(),
    presignGetObject: vi.fn(),
  };

  beforeEach(async () => {
    Object.values(learningService).forEach((mockFn) => mockFn.mockReset());
    Object.values(objectStorageService).forEach((mockFn) => mockFn.mockReset());

    learningService.getTaskSolutionRenderedAssetStateForStudent.mockResolvedValue({
      taskId: 'task-1',
      taskRevisionId: 'revision-1',
      htmlKey: 'tasks/task-1/revisions/revision-1/solution/1710000000000-1234abcd.html',
      htmlAssets: [
        {
          placeholder: 'CONTINUUMTIKZPLACEHOLDER1',
          assetKey: 'rendering/tikz/asset-1.svg',
          contentType: 'image/svg+xml',
        },
        {
          placeholder: 'CONTINUUMTIKZPLACEHOLDER10',
          assetKey: 'rendering/tikz/asset-10.svg',
          contentType: 'image/svg+xml',
        },
      ],
    });
    objectStorageService.getObjectText.mockResolvedValue(
      '<figure><img src="CONTINUUMTIKZPLACEHOLDER1" alt="" /></figure><figure><img src="CONTINUUMTIKZPLACEHOLDER10" alt="" /></figure><p>Student solution</p>',
    );
    objectStorageService.presignGetObject.mockImplementation(async (assetKey: string) => {
      if (assetKey.endsWith('asset-1.svg')) return 'https://storage.example/tikz-asset-1.svg';
      if (assetKey.endsWith('asset-10.svg')) return 'https://storage.example/tikz-asset-10.svg';
      return 'https://storage.example/unknown.svg';
    });

    app = await createIntegrationApp({
      controllers: [StudentTaskSolutionsController],
      providers: [
        { provide: LearningService, useValue: learningService },
        { provide: ObjectStorageService, useValue: objectStorageService },
        UnitPdfPolicyService,
      ],
      constructorParams: [
        {
          target: StudentTaskSolutionsController,
          deps: [LearningService, ObjectStorageService, UnitPdfPolicyService],
        },
      ],
      user: {
        id: 'student-1',
        login: 'student1',
        role: Role.student,
      },
    });
  });

  afterEach(async () => {
    await app.close();
  });

  it('returns rendered HTML with signed asset URLs', async () => {
    const response = await request(app.getHttpServer())
      .get('/student/tasks/task-1/solution/rendered-content')
      .query({ ttlSec: 180 });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      ok: true,
      taskId: 'task-1',
      taskRevisionId: 'revision-1',
      html:
        '<figure><img src="https://storage.example/tikz-asset-1.svg" alt="" /></figure><figure><img src="https://storage.example/tikz-asset-10.svg" alt="" /></figure><p>Student solution</p>',
      htmlKey: 'tasks/task-1/revisions/revision-1/solution/1710000000000-1234abcd.html',
      expiresInSec: 180,
    });
    expect(learningService.getTaskSolutionRenderedAssetStateForStudent).toHaveBeenCalledWith(
      'student-1',
      'task-1',
    );
    expect(objectStorageService.presignGetObject).toHaveBeenCalledWith(
      'rendering/tikz/asset-1.svg',
      180,
      'image/svg+xml',
    );
    expect(objectStorageService.presignGetObject).toHaveBeenCalledWith(
      'rendering/tikz/asset-10.svg',
      180,
      'image/svg+xml',
    );
  });

  it('propagates access-rule errors from learning service', async () => {
    learningService.getTaskSolutionRenderedAssetStateForStudent.mockRejectedValue(
      new ConflictException({
        code: 'UNIT_LOCKED',
        message: 'Unit is locked',
      }),
    );

    const response = await request(app.getHttpServer())
      .get('/student/tasks/task-1/solution/rendered-content')
      .query({ ttlSec: 180 });

    expect(response.status).toBe(409);
    expect(response.body).toMatchObject({
      code: 'UNIT_LOCKED',
      message: 'Unit is locked',
    });
  });
});
