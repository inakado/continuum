import { NotFoundException, type INestApplication } from '@nestjs/common';
import { Role, type CourseStatus, type SectionStatus } from '@prisma/client';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ContentService } from '../../src/content/content.service';
import { StudentCoursesController } from '../../src/content/student-courses.controller';
import { StudentSectionsController } from '../../src/content/student-sections.controller';
import { TeacherCoursesController } from '../../src/content/teacher-courses.controller';
import { TeacherSectionsController } from '../../src/content/teacher-sections.controller';
import { EventsLogService } from '../../src/events/events-log.service';
import { LearningService } from '../../src/learning/learning.service';
import { StudentSectionGraphController } from '../../src/learning/student-section-graph.controller';
import { createIntegrationApp } from './test-app.factory';

describe('content non-learning boundary integration', () => {
  let app: INestApplication;

  const contentService = {
    listCourses: vi.fn(),
    getCourse: vi.fn(),
    createCourse: vi.fn(),
    updateCourse: vi.fn(),
    publishCourse: vi.fn(),
    unpublishCourse: vi.fn(),
    deleteCourse: vi.fn(),
    getSection: vi.fn(),
    getSectionMeta: vi.fn(),
    createSection: vi.fn(),
    updateSection: vi.fn(),
    publishSection: vi.fn(),
    unpublishSection: vi.fn(),
    deleteSection: vi.fn(),
    listPublishedCourses: vi.fn(),
    getPublishedCourse: vi.fn(),
    getPublishedSection: vi.fn(),
  };
  const learningService = {
    getPublishedSectionGraphForStudent: vi.fn(),
  };
  const eventsLogService = {
    append: vi.fn(),
  };

  beforeEach(async () => {
    Object.values(contentService).forEach((mockFn) => mockFn.mockReset());
    Object.values(learningService).forEach((mockFn) => mockFn.mockReset());
    eventsLogService.append.mockReset();
    eventsLogService.append.mockResolvedValue(undefined);

    app = await createIntegrationApp({
      controllers: [
        TeacherCoursesController,
        TeacherSectionsController,
        StudentCoursesController,
        StudentSectionsController,
        StudentSectionGraphController,
      ],
      providers: [
        { provide: ContentService, useValue: contentService },
        { provide: LearningService, useValue: learningService },
        { provide: EventsLogService, useValue: eventsLogService },
      ],
      constructorParams: [
        {
          target: TeacherCoursesController,
          deps: [ContentService, EventsLogService],
        },
        {
          target: TeacherSectionsController,
          deps: [ContentService, EventsLogService],
        },
        {
          target: StudentCoursesController,
          deps: [ContentService],
        },
        {
          target: StudentSectionsController,
          deps: [ContentService],
        },
        {
          target: StudentSectionGraphController,
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

  function courseFixture(status: CourseStatus = 'draft') {
    return {
      id: 'course-1',
      title: 'Algebra',
      description: 'Numbers',
      status,
    };
  }

  function sectionFixture(status: SectionStatus = 'draft') {
    return {
      id: 'section-1',
      courseId: 'course-1',
      title: 'Linear equations',
      description: 'Section body',
      status,
      sortOrder: 1,
    };
  }

  it('covers teacher course list/create/update/publish/unpublish/delete HTTP paths', async () => {
    contentService.listCourses.mockResolvedValue([courseFixture()]);
    contentService.createCourse.mockResolvedValue(courseFixture());
    contentService.updateCourse.mockResolvedValue(courseFixture());
    contentService.publishCourse.mockResolvedValue(courseFixture('published'));
    contentService.unpublishCourse.mockResolvedValue(courseFixture('draft'));
    contentService.deleteCourse.mockResolvedValue(courseFixture('draft'));

    const listResponse = await request(app.getHttpServer()).get('/teacher/courses');
    const createResponse = await request(app.getHttpServer())
      .post('/teacher/courses')
      .send({ title: 'Algebra', description: 'Numbers' });
    const updateResponse = await request(app.getHttpServer())
      .patch('/teacher/courses/course-1')
      .send({ title: 'Advanced algebra' });
    const publishResponse = await request(app.getHttpServer()).post('/teacher/courses/course-1/publish');
    const unpublishResponse = await request(app.getHttpServer()).post('/teacher/courses/course-1/unpublish');
    const deleteResponse = await request(app.getHttpServer()).delete('/teacher/courses/course-1');

    expect(listResponse.status).toBe(200);
    expect(listResponse.body).toEqual([courseFixture()]);
    expect(createResponse.status).toBe(201);
    expect(updateResponse.status).toBe(200);
    expect(publishResponse.status).toBe(200);
    expect(unpublishResponse.status).toBe(200);
    expect(deleteResponse.status).toBe(200);
    expect(contentService.createCourse).toHaveBeenCalledWith({
      title: 'Algebra',
      description: 'Numbers',
    });
    expect(contentService.updateCourse).toHaveBeenCalledWith('course-1', {
      title: 'Advanced algebra',
    });
    expect(contentService.publishCourse).toHaveBeenCalledWith('course-1');
    expect(contentService.unpublishCourse).toHaveBeenCalledWith('course-1');
    expect(contentService.deleteCourse).toHaveBeenCalledWith('course-1');
    expect(eventsLogService.append).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        eventType: 'CourseCreated',
        entityType: 'course',
        entityId: 'course-1',
      }),
    );
    expect(eventsLogService.append).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        eventType: 'CourseUpdated',
        entityType: 'course',
        entityId: 'course-1',
      }),
    );
    expect(eventsLogService.append).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({
        eventType: 'CoursePublished',
        entityType: 'course',
        entityId: 'course-1',
      }),
    );
    expect(eventsLogService.append).toHaveBeenNthCalledWith(
      4,
      expect.objectContaining({
        eventType: 'CourseUnpublished',
        entityType: 'course',
        entityId: 'course-1',
      }),
    );
    expect(eventsLogService.append).toHaveBeenNthCalledWith(
      5,
      expect.objectContaining({
        eventType: 'CourseDeleted',
        entityType: 'course',
        entityId: 'course-1',
      }),
    );
  });

  it('covers teacher section get/create/update/publish/unpublish/delete HTTP paths', async () => {
    contentService.getSection.mockResolvedValue(sectionFixture());
    contentService.getSectionMeta.mockResolvedValue({
      id: 'section-1',
      courseId: 'course-1',
      title: 'Linear equations',
      status: 'draft',
    });
    contentService.createSection.mockResolvedValue(sectionFixture());
    contentService.updateSection.mockResolvedValue(sectionFixture());
    contentService.publishSection.mockResolvedValue(sectionFixture('published'));
    contentService.unpublishSection.mockResolvedValue(sectionFixture('draft'));
    contentService.deleteSection.mockResolvedValue(sectionFixture('draft'));

    const getResponse = await request(app.getHttpServer()).get('/teacher/sections/section-1');
    const metaResponse = await request(app.getHttpServer()).get('/teacher/sections/section-1/meta');
    const createResponse = await request(app.getHttpServer())
      .post('/teacher/sections')
      .send({
        courseId: 'course-1',
        title: 'Linear equations',
        description: 'Section body',
        sortOrder: 1,
      });
    const updateResponse = await request(app.getHttpServer())
      .patch('/teacher/sections/section-1')
      .send({ title: 'Updated section' });
    const publishResponse = await request(app.getHttpServer()).post('/teacher/sections/section-1/publish');
    const unpublishResponse = await request(app.getHttpServer())
      .post('/teacher/sections/section-1/unpublish');
    const deleteResponse = await request(app.getHttpServer()).delete('/teacher/sections/section-1');

    expect(getResponse.status).toBe(200);
    expect(getResponse.body.id).toBe('section-1');
    expect(metaResponse.status).toBe(200);
    expect(metaResponse.body).toEqual({
      id: 'section-1',
      courseId: 'course-1',
      title: 'Linear equations',
      status: 'draft',
    });
    expect(createResponse.status).toBe(201);
    expect(updateResponse.status).toBe(200);
    expect(publishResponse.status).toBe(200);
    expect(unpublishResponse.status).toBe(200);
    expect(deleteResponse.status).toBe(200);
    expect(contentService.createSection).toHaveBeenCalledWith({
      courseId: 'course-1',
      title: 'Linear equations',
      description: 'Section body',
      sortOrder: 1,
    });
    expect(contentService.updateSection).toHaveBeenCalledWith('section-1', {
      title: 'Updated section',
    });
    expect(contentService.getSectionMeta).toHaveBeenCalledWith('section-1');
    expect(eventsLogService.append).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        eventType: 'SectionCreated',
        entityType: 'section',
        entityId: 'section-1',
      }),
    );
    expect(eventsLogService.append).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        eventType: 'SectionUpdated',
        entityType: 'section',
        entityId: 'section-1',
      }),
    );
    expect(eventsLogService.append).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({
        eventType: 'SectionPublished',
        entityType: 'section',
        entityId: 'section-1',
      }),
    );
    expect(eventsLogService.append).toHaveBeenNthCalledWith(
      4,
      expect.objectContaining({
        eventType: 'SectionUnpublished',
        entityType: 'section',
        entityId: 'section-1',
      }),
    );
    expect(eventsLogService.append).toHaveBeenNthCalledWith(
      5,
      expect.objectContaining({
        eventType: 'SectionDeleted',
        entityType: 'section',
        entityId: 'section-1',
      }),
    );
  });

  it('returns 404 for missing teacher section meta', async () => {
    contentService.getSectionMeta.mockRejectedValueOnce(new NotFoundException('Section not found'));

    const response = await request(app.getHttpServer()).get('/teacher/sections/missing/meta');

    expect(response.status).toBe(404);
    expect(contentService.getSectionMeta).toHaveBeenCalledWith('missing');
  });

  it('covers student published content read paths', async () => {
    const publishedCourse = courseFixture('published');
    const publishedSection = sectionFixture('published');
    const graphResponse = {
      sectionId: 'section-1',
      units: [
        {
          id: 'unit-1',
          title: 'Unit 1',
          status: 'available',
        },
      ],
      edges: [{ fromUnitId: 'unit-1', toUnitId: 'unit-2' }],
    };

    contentService.listPublishedCourses.mockResolvedValue([publishedCourse]);
    contentService.getPublishedCourse.mockResolvedValue(publishedCourse);
    contentService.getPublishedSection.mockResolvedValue(publishedSection);
    learningService.getPublishedSectionGraphForStudent.mockResolvedValue(graphResponse);

    const listResponse = await request(app.getHttpServer()).get('/courses');
    const courseResponse = await request(app.getHttpServer()).get('/courses/course-1');
    const sectionResponse = await request(app.getHttpServer()).get('/sections/section-1');
    const graphResponseHttp = await request(app.getHttpServer()).get('/sections/section-1/graph');

    expect(listResponse.status).toBe(200);
    expect(courseResponse.status).toBe(200);
    expect(sectionResponse.status).toBe(200);
    expect(graphResponseHttp.status).toBe(200);
    expect(contentService.listPublishedCourses).toHaveBeenCalledTimes(1);
    expect(contentService.getPublishedCourse).toHaveBeenCalledWith('course-1');
    expect(contentService.getPublishedSection).toHaveBeenCalledWith('section-1');
    expect(learningService.getPublishedSectionGraphForStudent).toHaveBeenCalledWith(
      'teacher-1',
      'section-1',
    );
    expect(graphResponseHttp.body.sectionId).toBe('section-1');
  });
});
