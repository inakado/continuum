import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ContentService } from '../../src/content/content.service';
import { TeacherSectionGraphController } from '../../src/content/teacher-section-graph.controller';
import { TeacherUnitsController } from '../../src/content/teacher-units.controller';
import { UnitPdfPolicyService } from '../../src/content/unit-pdf-policy.service';
import { EventsLogService } from '../../src/events/events-log.service';
import { ObjectStorageService } from '../../src/infra/storage/object-storage.service';
import { LearningRecomputeService } from '../../src/learning/learning-recompute.service';
import { createIntegrationApp } from './test-app.factory';

describe('content publish/graph integration', () => {
  let app: INestApplication;

  const contentService = {
    publishUnit: vi.fn(),
    getSectionGraph: vi.fn(),
    updateSectionGraph: vi.fn(),
  };
  const eventsLogService = {
    append: vi.fn(),
  };
  const learningRecomputeService = {
    recomputeForSection: vi.fn(),
  };
  const objectStorageService = {
    getPresignedGetUrl: vi.fn(),
  };
  const unitPdfPolicyService = {
    parseTargetOrThrow: vi.fn(),
    resolveTtlForRole: vi.fn(),
  };

  beforeEach(async () => {
    Object.values(contentService).forEach((mockFn) => mockFn.mockReset());
    eventsLogService.append.mockReset();
    learningRecomputeService.recomputeForSection.mockReset();
    objectStorageService.getPresignedGetUrl.mockReset();
    unitPdfPolicyService.parseTargetOrThrow.mockReset();
    unitPdfPolicyService.resolveTtlForRole.mockReset();

    eventsLogService.append.mockResolvedValue(undefined);
    learningRecomputeService.recomputeForSection.mockResolvedValue(undefined);

    app = await createIntegrationApp({
      controllers: [TeacherUnitsController, TeacherSectionGraphController],
      providers: [
        { provide: ContentService, useValue: contentService },
        { provide: EventsLogService, useValue: eventsLogService },
        { provide: LearningRecomputeService, useValue: learningRecomputeService },
        { provide: ObjectStorageService, useValue: objectStorageService },
        { provide: UnitPdfPolicyService, useValue: unitPdfPolicyService },
      ],
      constructorParams: [
        {
          target: TeacherUnitsController,
          deps: [
            ContentService,
            EventsLogService,
            ObjectStorageService,
            UnitPdfPolicyService,
            LearningRecomputeService,
          ],
        },
        {
          target: TeacherSectionGraphController,
          deps: [ContentService, EventsLogService, LearningRecomputeService],
        },
      ],
    });
  });

  afterEach(async () => {
    await app.close();
  });

  it('smoke-tests unit publish write-path with recompute + audit call', async () => {
    contentService.publishUnit.mockResolvedValue({
      id: 'unit-1',
      title: 'Unit 1',
      status: 'published',
      sectionId: 'section-1',
    });

    const response = await request(app.getHttpServer()).post('/teacher/units/unit-1/publish');

    expect(response.status).toBe(200);
    expect(response.body.id).toBe('unit-1');
    expect(learningRecomputeService.recomputeForSection).toHaveBeenCalledWith('section-1');
    expect(eventsLogService.append).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'UnitPublished',
        entityType: 'unit',
        entityId: 'unit-1',
      }),
    );
  });

  it('smoke-tests section graph read/write paths', async () => {
    const graphResponse = {
      sectionId: 'section-1',
      nodes: [{ unitId: 'unit-1', position: { x: 10, y: 20 } }],
      edges: [{ id: 'edge-1', fromUnitId: 'unit-1', toUnitId: 'unit-2' }],
    };

    contentService.getSectionGraph.mockResolvedValue(graphResponse);
    contentService.updateSectionGraph.mockResolvedValue(graphResponse);

    const readResponse = await request(app.getHttpServer()).get('/teacher/sections/section-1/graph');
    const writeResponse = await request(app.getHttpServer())
      .put('/teacher/sections/section-1/graph')
      .send({
        nodes: [{ unitId: 'unit-1', position: { x: 10, y: 20 } }],
        edges: [{ fromUnitId: 'unit-1', toUnitId: 'unit-2' }],
      });

    expect(readResponse.status).toBe(200);
    expect(readResponse.body.sectionId).toBe('section-1');
    expect(writeResponse.status).toBe(200);
    expect(learningRecomputeService.recomputeForSection).toHaveBeenCalledWith('section-1');
    expect(eventsLogService.append).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'UnitGraphUpdated',
        entityType: 'section',
        entityId: 'section-1',
        payload: { nodes: 1, edges: 1 },
      }),
    );
  });
});
