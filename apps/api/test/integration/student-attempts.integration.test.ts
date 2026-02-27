import { BadRequestException, type INestApplication } from '@nestjs/common';
import { Role } from '@prisma/client';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LearningService } from '../../src/learning/learning.service';
import { StudentAttemptsController } from '../../src/learning/student-attempts.controller';
import { createIntegrationApp } from './test-app.factory';

describe('student attempts integration', () => {
  let app: INestApplication;

  const learningService = {
    submitAttempt: vi.fn(),
  };

  beforeEach(async () => {
    learningService.submitAttempt.mockReset();
    app = await createIntegrationApp({
      controllers: [StudentAttemptsController],
      providers: [{ provide: LearningService, useValue: learningService }],
      constructorParams: [
        { target: StudentAttemptsController, deps: [LearningService] },
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

  it('handles numeric/single/multi submit routes through HTTP boundary', async () => {
    learningService.submitAttempt
      .mockResolvedValueOnce({ status: 'correct', attemptNo: 1, wrongAttempts: 0, blockedUntil: null })
      .mockResolvedValueOnce({ status: 'incorrect', attemptNo: 2, wrongAttempts: 1, blockedUntil: null })
      .mockResolvedValueOnce({ status: 'correct', attemptNo: 3, wrongAttempts: 1, blockedUntil: null });

    const numericPayload = {
      answers: [{ partKey: 'p1', value: '42' }],
    };
    const singlePayload = { choiceKey: 'A' };
    const multiPayload = { choiceKeys: ['A', 'B'] };

    const numericResponse = await request(app.getHttpServer())
      .post('/student/tasks/task-numeric/attempts')
      .send(numericPayload);
    const singleResponse = await request(app.getHttpServer())
      .post('/student/tasks/task-single/attempts')
      .send(singlePayload);
    const multiResponse = await request(app.getHttpServer())
      .post('/student/tasks/task-multi/attempts')
      .send(multiPayload);

    expect(numericResponse.status).toBe(201);
    expect(singleResponse.status).toBe(201);
    expect(multiResponse.status).toBe(201);
    expect(learningService.submitAttempt).toHaveBeenNthCalledWith(1, 'student-1', 'task-numeric', numericPayload);
    expect(learningService.submitAttempt).toHaveBeenNthCalledWith(2, 'student-1', 'task-single', singlePayload);
    expect(learningService.submitAttempt).toHaveBeenNthCalledWith(3, 'student-1', 'task-multi', multiPayload);
  });

  it('preserves service error.code on invalid attempt payload', async () => {
    learningService.submitAttempt.mockRejectedValueOnce(
      new BadRequestException({
        code: 'INVALID_CHOICE_KEY',
        message: 'Invalid choiceKey',
      }),
    );

    const response = await request(app.getHttpServer())
      .post('/student/tasks/task-single/attempts')
      .send({ choiceKey: 'UNKNOWN' });

    expect(response.status).toBe(400);
    expect(response.body.code).toBe('INVALID_CHOICE_KEY');
    expect(response.body.message).toBe('Invalid choiceKey');
  });
});
