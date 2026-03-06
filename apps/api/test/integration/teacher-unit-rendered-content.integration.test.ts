import { Role } from '@prisma/client';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ContentService } from '../../src/content/content.service';
import { TeacherUnitsController } from '../../src/content/teacher-units.controller';
import { UnitPdfPolicyService } from '../../src/content/unit-pdf-policy.service';
import { EventsLogService } from '../../src/events/events-log.service';
import { ObjectStorageService } from '../../src/infra/storage/object-storage.service';
import { LearningRecomputeService } from '../../src/learning/learning-recompute.service';
import { createIntegrationApp } from './test-app.factory';

describe('teacher unit rendered-content integration', () => {
  let app: INestApplication;

  const contentService = {
    getUnit: vi.fn(),
    getUnitRenderedAssetState: vi.fn(),
  };
  const eventsLogService = {
    append: vi.fn(),
  };
  const objectStorageService = {
    getPresignedGetUrl: vi.fn(),
    getObjectText: vi.fn(),
    presignGetObject: vi.fn(),
  };
  const learningRecomputeService = {
    recomputeForSection: vi.fn(),
  };

  beforeEach(async () => {
    Object.values(contentService).forEach((mockFn) => mockFn.mockReset());
    Object.values(eventsLogService).forEach((mockFn) => mockFn.mockReset());
    Object.values(objectStorageService).forEach((mockFn) => mockFn.mockReset());
    Object.values(learningRecomputeService).forEach((mockFn) => mockFn.mockReset());

    contentService.getUnitRenderedAssetState.mockResolvedValue({
      unitId: 'unit-1',
      pdfAssetKey: 'units/unit-1/theory/1710000000000-1234abcd.pdf',
      htmlAssetKey: 'units/unit-1/theory/1710000000000-1234abcd.html',
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
    objectStorageService.getPresignedGetUrl.mockResolvedValue('https://storage.example/theory.pdf');
    objectStorageService.getObjectText.mockResolvedValue(
      '<figure><img src="CONTINUUMTIKZPLACEHOLDER1" alt="" /></figure><figure><img src="CONTINUUMTIKZPLACEHOLDER10" alt="" /></figure><p>HTML</p>',
    );
    objectStorageService.presignGetObject.mockImplementation(async (assetKey: string) => {
      if (assetKey.endsWith('asset-1.svg')) return 'https://storage.example/asset-1.svg';
      if (assetKey.endsWith('asset-10.svg')) return 'https://storage.example/asset-10.svg';
      return 'https://storage.example/unknown.svg';
    });

    app = await createIntegrationApp({
      controllers: [TeacherUnitsController],
      providers: [
        { provide: ContentService, useValue: contentService },
        { provide: EventsLogService, useValue: eventsLogService },
        { provide: ObjectStorageService, useValue: objectStorageService },
        { provide: LearningRecomputeService, useValue: learningRecomputeService },
        UnitPdfPolicyService,
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

  it('returns teacher rendered-content with signed asset URLs', async () => {
    const response = await request(app.getHttpServer())
      .get('/teacher/units/unit-1/rendered-content')
      .query({ target: 'theory', ttlSec: 600 });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      ok: true,
      target: 'theory',
      html: '<figure><img src="https://storage.example/asset-1.svg" alt="" /></figure><figure><img src="https://storage.example/asset-10.svg" alt="" /></figure><p>HTML</p>',
      htmlKey: 'units/unit-1/theory/1710000000000-1234abcd.html',
      pdfUrl: 'https://storage.example/theory.pdf',
      pdfKey: 'units/unit-1/theory/1710000000000-1234abcd.pdf',
      expiresInSec: 600,
    });
    expect(contentService.getUnitRenderedAssetState).toHaveBeenCalledWith('unit-1', 'theory');
    expect(objectStorageService.presignGetObject).toHaveBeenCalledWith(
      'rendering/tikz/asset-1.svg',
      600,
      'image/svg+xml',
    );
    expect(objectStorageService.presignGetObject).toHaveBeenCalledWith(
      'rendering/tikz/asset-10.svg',
      600,
      'image/svg+xml',
    );
  });
});
