import { LessonReaderStateSchema, type InteractiveLessonManifest, type LessonReaderState } from '@continuum/shared';

// This policy is inserted before every byte of the imported document. A package
// may tighten it with another CSP, but cannot relax this first policy.
export const lessonSandboxPolicy = [
  "default-src 'none'", "script-src 'unsafe-inline'", "style-src 'unsafe-inline'",
  'img-src data: blob:', 'font-src data:', "connect-src 'none'", "frame-src 'none'",
  "object-src 'none'", "base-uri 'none'", "form-action 'none'",
].join('; ');

export function sandboxDocument(html: string) {
  return `<!doctype html><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="${lessonSandboxPolicy}"><meta name="referrer" content="no-referrer">${html}`;
}

export function filterReaderState(state: LessonReaderState, manifest: InteractiveLessonManifest): LessonReaderState {
  return {
    readingScale: state.readingScale,
    answers: Object.fromEntries(manifest.questions.flatMap(({ id }) => Object.hasOwn(state.answers, id) ? [[id, state.answers[id]]] : [])),
  };
}

export function readerStorageKey(scope: string, manifest: InteractiveLessonManifest) {
  return `continuum:interactive:reader:v1:${scope}:${manifest.lessonId}`;
}

export function restoreReaderState(value: string | null, manifest: InteractiveLessonManifest): LessonReaderState {
  const initial: LessonReaderState = { readingScale: 100, answers: {} };
  if (!value || value.length > 32_768) return initial;
  try {
    const saved = JSON.parse(value) as { state?: unknown; revisions?: Record<string, unknown> };
    const result = LessonReaderStateSchema.safeParse(saved.state);
    if (!result.success) return initial;
    const state = filterReaderState(result.data, manifest);
    for (const question of manifest.questions) {
      if (saved.revisions?.[question.id] !== question.revision) delete state.answers[question.id];
    }
    return state;
  } catch { return initial; }
}

export function serializeReaderState(state: LessonReaderState, manifest: InteractiveLessonManifest) {
  return JSON.stringify({ state: filterReaderState(state, manifest), revisions: Object.fromEntries(manifest.questions.map(({ id, revision }) => [id, revision])) });
}
