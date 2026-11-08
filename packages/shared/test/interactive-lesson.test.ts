import { describe, expect, it } from 'vitest';
import { InteractiveLessonDocumentSchema, InteractiveLessonManifestSchema } from '../src/contracts/interactive-lesson';
const manifest = { schemaVersion: 1, lessonId: 'kin-01', title: 'Кинематика', entrypoint: 'lesson.html', contentSha256: 'a'.repeat(64), sections: [{ id: 'start', title: 'Начало' }] };
describe('interactive lesson format v1', () => {
  it('provides optional empty questions and keeps independent content identifiers', () => {
    expect(InteractiveLessonManifestSchema.parse(manifest).questions).toEqual([]);
  });
  it.each([
    { ...manifest, schemaVersion: 2 },
    { ...manifest, sections: [] },
    { ...manifest, sections: [manifest.sections[0], manifest.sections[0]] },
    { ...manifest, questions: [{ id: 'term', revision: 1 }, { id: 'term', revision: 2 }] },
    { ...manifest, questions: [{ id: 'term', revision: 0 }] },
    { ...manifest, sections: [{ id: 'start#bad', title: 'Bad' }] },
    { ...manifest, secret: true },
  ])('rejects ambiguous or unsupported manifests %#', (value) => {
    expect(InteractiveLessonManifestSchema.safeParse(value).success).toBe(false);
  });
  it('rejects missing document/version binding and extra response data', () => {
    expect(InteractiveLessonDocumentSchema.safeParse({ artifactId: 'bad', manifest, html: '<html></html>' }).success).toBe(false);
    expect(InteractiveLessonDocumentSchema.safeParse({ artifactId: 'e9fe9723-d927-4315-87ea-3cf73d9e467a', manifest, html: '<html></html>', objectKey: 'secret' }).success).toBe(false);
  });
});
