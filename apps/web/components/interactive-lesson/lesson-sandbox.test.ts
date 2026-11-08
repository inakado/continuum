import { describe, expect, it } from 'vitest';
import type { InteractiveLessonManifest } from '@continuum/shared';
import { filterReaderState, readerStorageKey, restoreReaderState, sandboxDocument, serializeReaderState } from './lesson-sandbox';

const manifest: InteractiveLessonManifest = { schemaVersion: 1, lessonId: 'kin-01', title: 'Кинематика', entrypoint: 'lesson.html', contentSha256: 'a'.repeat(64), sections: [{ id: 'intro', title: 'Начало' }], questions: [{ id: 'motion', revision: 2 }] };

describe('interactive sandbox and persistence boundary', () => {
  it('places the restrictive policy before imported markup, including a hostile CSP', () => {
    const html = '<meta http-equiv="Content-Security-Policy" content="default-src *"><script>window.bad=true</script>';
    const result = sandboxDocument(html);
    expect(result.indexOf("connect-src 'none'")).toBeLessThan(result.indexOf(html));
    expect(result).toContain("script-src 'unsafe-inline'");
    expect(result).toContain("form-action 'none'");
    expect(result).not.toContain("script-src *");
  });
  it('does not allow a package to write arbitrary answer identifiers', () => {
    expect(filterReaderState({ readingScale: 90, answers: { motion: 'incorrect', stranger: 'correct' } }, manifest)).toEqual({ readingScale: 90, answers: { motion: 'incorrect' } });
  });
  it('restores both checked results but invalidates changed question revisions', () => {
    for (const result of ['correct', 'incorrect'] as const) {
      const saved = serializeReaderState({ readingScale: 110, answers: { motion: result } }, manifest);
      expect(restoreReaderState(saved, manifest)).toEqual({ readingScale: 110, answers: { motion: result } });
      expect(restoreReaderState(saved, { ...manifest, questions: [{ id: 'motion', revision: 3 }] })).toEqual({ readingScale: 110, answers: {} });
    }
  });
  it('isolates readers and lectures; malformed and oversized storage cannot prevent reading', () => {
    expect(readerStorageKey('alice', manifest)).not.toEqual(readerStorageKey('bob', manifest));
    expect(readerStorageKey('alice', manifest)).not.toEqual(readerStorageKey('alice', { ...manifest, lessonId: 'kin-02' }));
    for (const value of [null, 'null', '{', 'x'.repeat(40_000), JSON.stringify({ state: { readingScale: 1, answers: {} } })]) {
      expect(restoreReaderState(value, manifest)).toEqual({ readingScale: 100, answers: {} });
    }
  });
});
