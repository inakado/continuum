import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PhotoTaskService } from '../../src/learning/photo-task.service';
import { StudentPhotoTasksController } from '../../src/learning/student-photo-tasks.controller';
import { TeacherPhotoReviewInboxController } from '../../src/learning/teacher-photo-review-inbox.controller';
import { TeacherPhotoSubmissionsController } from '../../src/learning/teacher-photo-submissions.controller';
import { createIntegrationApp } from './test-app.factory';

describe('learning photo boundary integration', () => {
  let app: INestApplication;

  const photoTaskService = {
    presignUpload: vi.fn(),
    submit: vi.fn(),
    listForStudent: vi.fn(),
    presignViewForStudent: vi.fn(),
    listInboxForTeacher: vi.fn(),
    getInboxSubmissionForTeacher: vi.fn(),
    listQueueForTeacher: vi.fn(),
    listForTeacher: vi.fn(),
    presignViewForTeacher: vi.fn(),
    accept: vi.fn(),
    reject: vi.fn(),
  };

  beforeEach(async () => {
    Object.values(photoTaskService).forEach((mockFn) => mockFn.mockReset());
    photoTaskService.presignUpload.mockResolvedValue({
      uploads: [{ assetKey: 'tasks/t1/photo/student/rev/1.jpg', url: 'http://upload', headers: {} }],
      expiresInSec: 300,
    });
    photoTaskService.presignViewForStudent.mockResolvedValue({
      ok: true,
      assetKey: 'tasks/t1/photo/student/rev/1.jpg',
      expiresInSec: 180,
      url: 'http://view',
    });
    photoTaskService.reject.mockResolvedValue({ ok: true });

    app = await createIntegrationApp({
      controllers: [
        StudentPhotoTasksController,
        TeacherPhotoReviewInboxController,
        TeacherPhotoSubmissionsController,
      ],
      providers: [{ provide: PhotoTaskService, useValue: photoTaskService }],
      constructorParams: [
        { target: StudentPhotoTasksController, deps: [PhotoTaskService] },
        { target: TeacherPhotoReviewInboxController, deps: [PhotoTaskService] },
        { target: TeacherPhotoSubmissionsController, deps: [PhotoTaskService] },
      ],
    });
  });

  afterEach(async () => {
    await app.close();
  });

  it('accepts valid presign-upload payload and returns service response', async () => {
    const response = await request(app.getHttpServer())
      .post('/student/tasks/task-1/photo/presign-upload')
      .send({
        files: [
          { filename: 'photo.jpg', contentType: 'image/jpeg', sizeBytes: 1024 },
        ],
        ttlSec: 300,
      });

    expect(response.status).toBe(200);
    expect(response.body.expiresInSec).toBe(300);
    expect(photoTaskService.presignUpload).toHaveBeenCalledWith(
      'integration-user',
      'task-1',
      expect.objectContaining({ ttlSec: 300 }),
    );
  });

  it('returns legacy 409 INVALID_ASSET_KEY on invalid submit payload', async () => {
    const response = await request(app.getHttpServer())
      .post('/student/tasks/task-1/photo/submit')
      .send({ assetKeys: [] });

    expect(response.status).toBe(409);
    expect(response.body.code).toBe('INVALID_ASSET_KEY');
  });

  it('returns legacy query validation codes for teacher queue/inbox', async () => {
    const invalidQueue = await request(app.getHttpServer())
      .get('/teacher/students/student-1/photo-submissions?status=pending');
    const invalidInbox = await request(app.getHttpServer())
      .get('/teacher/photo-submissions?sort=latest');

    expect(invalidQueue.status).toBe(409);
    expect(invalidQueue.body.code).toBe('INVALID_QUEUE_STATUS');
    expect(invalidInbox.status).toBe(409);
    expect(invalidInbox.body.code).toBe('INVALID_SORT');
  });

  it('returns legacy 400 INVALID_TTL on invalid presign-view ttl', async () => {
    const response = await request(app.getHttpServer())
      .get('/student/tasks/task-1/photo/presign-view?assetKey=tasks/t1/photo/student/rev/1.jpg&ttlSec=0');

    expect(response.status).toBe(400);
    expect(response.body.code).toBe('INVALID_TTL');
  });

  it('handles valid reject request and delegates to service', async () => {
    const response = await request(app.getHttpServer())
      .post('/teacher/students/student-1/tasks/task-1/photo-submissions/sub-1/reject')
      .send({ reason: 'Need clearer photo' });

    expect(response.status).toBe(200);
    expect(photoTaskService.reject).toHaveBeenCalledWith(
      'integration-user',
      'student-1',
      'task-1',
      'sub-1',
      { reason: 'Need clearer photo' },
    );
  });
});
