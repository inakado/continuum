import { describe, expect, it } from 'vitest';
import { HostToLessonMessageSchema, LessonToHostMessageSchema } from './interactive-lesson-bridge';

describe('interactive lesson bridge contract', () => {
  const base = { channel: 'continuum.lesson', version: 1 };
  it('accepts only explicitly versioned commands with bounded reader state', () => {
    expect(HostToLessonMessageSchema.safeParse({ ...base, type: 'navigate', sectionId: 'path' }).success).toBe(true);
    expect(HostToLessonMessageSchema.safeParse({ ...base, type: 'scale', value: 90 }).success).toBe(true);
    expect(LessonToHostMessageSchema.safeParse({ ...base, type: 'state', state: { readingScale: 100, answers: { motion: 'incorrect' } } }).success).toBe(true);
    for (const data of [
      { ...base, version: 2, type: 'ready' },
      { ...base, type: 'navigate', sectionId: 'javascript:alert(1)' },
      { ...base, type: 'scale', value: 101 },
      { ...base, type: 'init', state: { readingScale: 100, answers: {} }, visible: true, cookie: 'secret' },
    ]) expect(HostToLessonMessageSchema.safeParse(data).success).toBe(false);
    expect(LessonToHostMessageSchema.safeParse({ ...base, type: 'state', state: { readingScale: 100, answers: Object.fromEntries(Array.from({ length: 101 }, (_, i) => [`q-${i}`, 'correct'])) } }).success).toBe(false);
  });
});
