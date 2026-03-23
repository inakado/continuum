import { Role } from '@prisma/client';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EventsLogService } from '../../src/events/events-log.service';
import { LearningService } from '../../src/learning/learning.service';
import { TeacherSectionOverrideOpenController } from '../../src/learning/teacher-section-override-open.controller';
import { TeacherTaskCreditController } from '../../src/learning/teacher-task-credit.controller';
import { TeacherUnitOverrideOpenController } from '../../src/learning/teacher-unit-override-open.controller';
import { StudentsService } from '../../src/students/students.service';
import { TeacherStudentsController } from '../../src/students/teacher-students.controller';
import { createIntegrationApp } from './test-app.factory';

describe('teacher students boundary integration', () => {
  let app: INestApplication;

  const studentsService = {
    listStudents: vi.fn(),
    getStudentProfileDetails: vi.fn(),
    createStudent: vi.fn(),
    resetPassword: vi.fn(),
    transferStudent: vi.fn(),
    updateStudentProfile: vi.fn(),
    deleteStudent: vi.fn(),
  };
  const learningService = {
    creditTaskWithReason: vi.fn(),
    overrideOpenSection: vi.fn(),
    overrideOpenUnit: vi.fn(),
  };
  const eventsLogService = {
    append: vi.fn(),
  };

  beforeEach(async () => {
    Object.values(studentsService).forEach((mockFn) => mockFn.mockReset());
    Object.values(learningService).forEach((mockFn) => mockFn.mockReset());
    eventsLogService.append.mockReset();
    eventsLogService.append.mockResolvedValue(undefined);

    app = await createIntegrationApp({
      controllers: [
        TeacherStudentsController,
        TeacherSectionOverrideOpenController,
        TeacherTaskCreditController,
        TeacherUnitOverrideOpenController,
      ],
      providers: [
        { provide: StudentsService, useValue: studentsService },
        { provide: LearningService, useValue: learningService },
        { provide: EventsLogService, useValue: eventsLogService },
      ],
      constructorParams: [
        {
          target: TeacherStudentsController,
          deps: [StudentsService, EventsLogService],
        },
        {
          target: TeacherSectionOverrideOpenController,
          deps: [LearningService],
        },
        {
          target: TeacherTaskCreditController,
          deps: [LearningService],
        },
        {
          target: TeacherUnitOverrideOpenController,
          deps: [LearningService],
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

  it('covers teacher students list/detail/create/update/transfer/reset/delete paths', async () => {
    studentsService.listStudents.mockResolvedValue([
      { id: 'student-1', login: 'student1', firstName: 'Ann', lastName: 'Lee' },
    ]);
    studentsService.getStudentProfileDetails.mockResolvedValue({
      id: 'student-1',
      login: 'student1',
      firstName: 'Ann',
      lastName: 'Lee',
      units: [],
      courses: [],
    });
    studentsService.createStudent.mockResolvedValue({
      user: { id: 'student-1', login: 'student1' },
      profile: {
        leadTeacherId: 'teacher-1',
        firstName: 'Ann',
        lastName: 'Lee',
      },
      password: 'Pass123!',
    });
    studentsService.updateStudentProfile.mockResolvedValue({
      id: 'student-1',
      firstName: 'Anna',
      lastName: 'Lee',
    });
    studentsService.transferStudent.mockResolvedValue({
      id: 'student-1',
      login: 'student1',
      previousLeadTeacherId: 'teacher-1',
      leadTeacherId: 'teacher-2',
      leadTeacherLogin: 'teacher2',
    });
    studentsService.resetPassword.mockResolvedValue({
      id: 'student-1',
      login: 'student1',
      password: 'Reset123!',
    });
    studentsService.deleteStudent.mockResolvedValue({
      id: 'student-1',
      login: 'student1',
      leadTeacherId: 'teacher-2',
      firstName: 'Anna',
      lastName: 'Lee',
    });

    const listResponse = await request(app.getHttpServer()).get('/teacher/students?query=ann');
    const detailResponse = await request(app.getHttpServer()).get(
      '/teacher/students/student-1?courseId=course-1',
    );
    const createResponse = await request(app.getHttpServer())
      .post('/teacher/students')
      .send({ login: 'student1', firstName: 'Ann', lastName: 'Lee' });
    const updateResponse = await request(app.getHttpServer())
      .patch('/teacher/students/student-1')
      .send({ firstName: 'Anna' });
    const transferResponse = await request(app.getHttpServer())
      .patch('/teacher/students/student-1/transfer')
      .send({ leaderTeacherId: 'teacher-2' });
    const resetResponse = await request(app.getHttpServer())
      .post('/teacher/students/student-1/reset-password')
      .send();
    const deleteResponse = await request(app.getHttpServer()).delete('/teacher/students/student-1');

    expect(listResponse.status).toBe(200);
    expect(detailResponse.status).toBe(200);
    expect(createResponse.status).toBe(201);
    expect(updateResponse.status).toBe(200);
    expect(transferResponse.status).toBe(200);
    expect(resetResponse.status).toBe(200);
    expect(deleteResponse.status).toBe(200);
    expect(studentsService.listStudents).toHaveBeenCalledWith('teacher-1', 'ann');
    expect(studentsService.getStudentProfileDetails).toHaveBeenCalledWith(
      'teacher-1',
      'student-1',
      'course-1',
    );
    expect(studentsService.createStudent).toHaveBeenCalledWith(
      'student1',
      'teacher-1',
      'Ann',
      'Lee',
    );
    expect(studentsService.updateStudentProfile).toHaveBeenCalledWith(
      'student-1',
      'teacher-1',
      'Anna',
      undefined,
    );
    expect(studentsService.transferStudent).toHaveBeenCalledWith(
      'student-1',
      'teacher-1',
      'teacher-2',
    );
    expect(studentsService.resetPassword).toHaveBeenCalledWith('student-1', 'teacher-1');
    expect(studentsService.deleteStudent).toHaveBeenCalledWith('student-1', 'teacher-1');
    expect(createResponse.body).toEqual({
      id: 'student-1',
      login: 'student1',
      leadTeacherId: 'teacher-1',
      firstName: 'Ann',
      lastName: 'Lee',
      password: 'Pass123!',
    });
    expect(transferResponse.body).toEqual({
      id: 'student-1',
      login: 'student1',
      leadTeacherId: 'teacher-2',
      leadTeacherLogin: 'teacher2',
    });
    expect(eventsLogService.append).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        eventType: 'StudentCreated',
        entityType: 'student',
        entityId: 'student-1',
      }),
    );
    expect(eventsLogService.append).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        eventType: 'LeadTeacherAssignedToStudent',
        entityType: 'student',
        entityId: 'student-1',
      }),
    );
    expect(eventsLogService.append).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({
        eventType: 'StudentProfileUpdated',
        entityType: 'student',
        entityId: 'student-1',
      }),
    );
    expect(eventsLogService.append).toHaveBeenNthCalledWith(
      4,
      expect.objectContaining({
        eventType: 'LeadTeacherReassignedForStudent',
        entityType: 'student',
        entityId: 'student-1',
      }),
    );
    expect(eventsLogService.append).toHaveBeenNthCalledWith(
      5,
      expect.objectContaining({
        eventType: 'StudentPasswordReset',
        entityType: 'student',
        entityId: 'student-1',
      }),
    );
    expect(eventsLogService.append).toHaveBeenNthCalledWith(
      6,
      expect.objectContaining({
        eventType: 'StudentDeleted',
        entityType: 'student',
        entityId: 'student-1',
      }),
    );
  });

  it('covers teacher task credit and section/unit override-open HTTP paths', async () => {
    learningService.creditTaskWithReason.mockResolvedValue({
      ok: true,
      taskId: 'task-1',
      creditedAt: '2026-03-01T10:00:00.000Z',
    });
    learningService.overrideOpenSection.mockResolvedValue({
      ok: true,
      sectionId: 'section-1',
      overrideOpenedAt: '2026-03-01T10:00:00.000Z',
    });
    learningService.overrideOpenUnit.mockResolvedValue({
      ok: true,
      unitId: 'unit-1',
      overrideOpenedAt: '2026-03-01T10:00:00.000Z',
    });

    const creditResponse = await request(app.getHttpServer())
      .post('/teacher/students/student-1/tasks/task-1/credit')
      .send({ reason: 'Teacher approved oral answer' });
    const sectionOverrideResponse = await request(app.getHttpServer())
      .post('/teacher/students/student-1/sections/section-1/override-open')
      .send({ reason: 'Manual section unlock' });
    const overrideResponse = await request(app.getHttpServer())
      .post('/teacher/students/student-1/units/unit-1/override-open')
      .send({ reason: 'Manual unlock' });

    expect(creditResponse.status).toBe(200);
    expect(sectionOverrideResponse.status).toBe(200);
    expect(overrideResponse.status).toBe(200);
    expect(learningService.creditTaskWithReason).toHaveBeenCalledWith(
      'teacher-1',
      'student-1',
      'task-1',
      'Teacher approved oral answer',
    );
    expect(learningService.overrideOpenSection).toHaveBeenCalledWith(
      'teacher-1',
      'student-1',
      'section-1',
      'Manual section unlock',
    );
    expect(learningService.overrideOpenUnit).toHaveBeenCalledWith(
      'teacher-1',
      'student-1',
      'unit-1',
      'Manual unlock',
    );
  });
});
