import { Role } from '@prisma/client';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EventsLogService } from '../../src/events/events-log.service';
import { ObjectStorageService } from '../../src/infra/storage/object-storage.service';
import { LearningRecomputeService } from '../../src/learning/learning-recompute.service';
import { ContentService } from '../../src/content/content.service';
import { TaskStatementImagePolicyService } from '../../src/content/task-statement-image-policy.service';
import { TeacherTasksController } from '../../src/content/teacher-tasks.controller';
import { createIntegrationApp } from './test-app.factory';

describe('task statement image boundary integration', () => {
  let app: INestApplication;

  const contentService = {
    getTaskStatementImageState: vi.fn(),
    setTaskRevisionStatementImageAssetKey: vi.fn(),
  };
  const eventsLogService = {
    append: vi.fn(),
  };
  const learningRecomputeService = {
    recomputeForTask: vi.fn(),
  };
  const objectStorageService = {
    presignPutObject: vi.fn(),
    getObjectMeta: vi.fn(),
    presignGetObject: vi.fn(),
  };

  beforeEach(async () => {
    contentService.getTaskStatementImageState.mockReset();
    contentService.setTaskRevisionStatementImageAssetKey.mockReset();
    eventsLogService.append.mockReset();
    learningRecomputeService.recomputeForTask.mockReset();
    objectStorageService.presignPutObject.mockReset();
    objectStorageService.getObjectMeta.mockReset();
    objectStorageService.presignGetObject.mockReset();

    contentService.getTaskStatementImageState.mockResolvedValue({
      taskId: 'task-1',
      activeRevisionId: 'revision-1',
      statementImageAssetKey: 'tasks/task-1/revisions/revision-1/statement-image/1710000000000-1234abcd.png',
    });
    objectStorageService.presignPutObject.mockResolvedValue({
      url: 'https://storage.example/upload',
      headers: { 'x-amz-meta-test': '1' },
    });
    objectStorageService.getObjectMeta.mockResolvedValue({ exists: true });
    objectStorageService.presignGetObject.mockResolvedValue('https://storage.example/view');
    contentService.setTaskRevisionStatementImageAssetKey.mockResolvedValue({
      statementImageAssetKey: 'tasks/task-1/revisions/revision-1/statement-image/1710000000000-1234abcd.png',
    });

    app = await createIntegrationApp({
      controllers: [TeacherTasksController],
      providers: [
        { provide: ContentService, useValue: contentService },
        { provide: EventsLogService, useValue: eventsLogService },
        { provide: LearningRecomputeService, useValue: learningRecomputeService },
        { provide: ObjectStorageService, useValue: objectStorageService },
        TaskStatementImagePolicyService,
      ],
      constructorParams: [
        {
          target: TeacherTasksController,
          deps: [
            ContentService,
            EventsLogService,
            LearningRecomputeService,
            ObjectStorageService,
            TaskStatementImagePolicyService,
          ],
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
    await app.close();
  });

  it('accepts valid presign-upload payloads in envelope and direct-body formats', async () => {
    const envelopeResponse = await request(app.getHttpServer())
      .post('/teacher/tasks/task-1/statement-image/presign-upload')
      .send({
        file: {
          filename: 'diagram.png',
          contentType: 'image/png',
          sizeBytes: 1024,
        },
        ttlSec: 300,
      });

    const directResponse = await request(app.getHttpServer())
      .post('/teacher/tasks/task-1/statement-image/presign-upload')
      .send({
        filename: 'diagram.webp',
        contentType: 'image/webp',
        sizeBytes: 2048,
      });

    expect(envelopeResponse.status).toBe(200);
    expect(envelopeResponse.body).toMatchObject({
      uploadUrl: 'https://storage.example/upload',
      expiresInSec: 300,
    });
    expect(directResponse.status).toBe(200);
    expect(directResponse.body.expiresInSec).toBe(300);
    expect(objectStorageService.presignPutObject).toHaveBeenCalledTimes(2);
    expect(objectStorageService.presignPutObject).toHaveBeenNthCalledWith(
      1,
      expect.stringMatching(/^tasks\/task-1\/revisions\/revision-1\/statement-image\/.+\.png$/),
      'image/png',
      300,
    );
    expect(objectStorageService.presignPutObject).toHaveBeenNthCalledWith(
      2,
      expect.stringMatching(/^tasks\/task-1\/revisions\/revision-1\/statement-image\/.+\.webp$/),
      'image/webp',
      300,
    );
  });

  it('preserves exact error codes for invalid statement-image boundary payloads', async () => {
    const invalidTtl = await request(app.getHttpServer())
      .post('/teacher/tasks/task-1/statement-image/presign-upload')
      .send({
        file: {
          filename: 'diagram.png',
          contentType: 'image/png',
          sizeBytes: 1024,
        },
        ttlSec: 0,
      });

    const invalidContentType = await request(app.getHttpServer())
      .post('/teacher/tasks/task-1/statement-image/presign-upload')
      .send({
        file: {
          filename: 'diagram.gif',
          contentType: 'image/gif',
          sizeBytes: 1024,
        },
      });

    const invalidAssetKey = await request(app.getHttpServer())
      .post('/teacher/tasks/task-1/statement-image/apply')
      .send({ assetKey: '' });

    const invalidViewTtl = await request(app.getHttpServer())
      .get('/teacher/tasks/task-1/statement-image/presign-view')
      .query({ ttlSec: 0 });

    expect(invalidTtl.status).toBe(400);
    expect(invalidTtl.body).toMatchObject({
      code: 'INVALID_TTL',
      message: 'ttlSec must be a positive integer',
    });

    expect(invalidContentType.status).toBe(400);
    expect(invalidContentType.body).toMatchObject({
      code: 'INVALID_FILE_TYPE',
      message: 'contentType must be one of: image/jpeg, image/png, image/webp',
    });

    expect(invalidAssetKey.status).toBe(409);
    expect(invalidAssetKey.body).toMatchObject({
      code: 'INVALID_ASSET_KEY',
      message: 'assetKey is required',
    });

    expect(invalidViewTtl.status).toBe(400);
    expect(invalidViewTtl.body).toMatchObject({
      code: 'INVALID_TTL',
      message: 'ttlSec must be a positive integer',
    });
  });

  it('accepts valid apply and presign-view payloads through the HTTP boundary', async () => {
    const assetKey = 'tasks/task-1/revisions/revision-1/statement-image/1710000000000-1234abcd.png';

    const applyResponse = await request(app.getHttpServer())
      .post('/teacher/tasks/task-1/statement-image/apply')
      .send({ assetKey });

    const viewResponse = await request(app.getHttpServer())
      .get('/teacher/tasks/task-1/statement-image/presign-view')
      .query({ ttlSec: 600 });

    expect(applyResponse.status).toBe(200);
    expect(applyResponse.body).toEqual({
      ok: true,
      taskId: 'task-1',
      taskRevisionId: 'revision-1',
      assetKey,
    });
    expect(contentService.setTaskRevisionStatementImageAssetKey).toHaveBeenCalledWith('revision-1', assetKey);

    expect(viewResponse.status).toBe(200);
    expect(viewResponse.body).toEqual({
      ok: true,
      taskId: 'task-1',
      taskRevisionId: 'revision-1',
      key: 'tasks/task-1/revisions/revision-1/statement-image/1710000000000-1234abcd.png',
      expiresInSec: 600,
      url: 'https://storage.example/view',
    });
  });
});
