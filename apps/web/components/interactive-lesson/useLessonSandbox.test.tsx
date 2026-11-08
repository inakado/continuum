import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { InteractiveLessonDocument } from '@continuum/shared';
import { useLessonSandbox } from './useLessonSandbox';
import { readerStorageKey, restoreReaderState } from './lesson-sandbox';

const artifact: InteractiveLessonDocument = { artifactId: '00000000-0000-4000-a000-000000000001', manifest: { schemaVersion: 1, lessonId: 'kin-01', title: 'Кинематика', entrypoint: 'lesson.html', contentSha256: 'a'.repeat(64), sections: [{ id: 'intro', title: 'Начало' }, { id: 'path', title: 'Путь' }], questions: [{ id: 'motion', revision: 1 }] }, html: '<p>Lesson</p>' };
function Harness() {
  const reader = useLessonSandbox(artifact, 'alice');
  return <><iframe ref={reader.frame} title="Lesson" /><output>{reader.ready ? reader.active : 'loading'}:{reader.state.readingScale}</output></>;
}
const envelope = { channel: 'continuum.lesson', version: 1 };
function message(data: object, source?: Window | null, origin = 'null') {
  act(() => window.dispatchEvent(new MessageEvent('message', { data: { ...envelope, ...data }, source: source ?? (screen.getByTitle('Lesson') as HTMLIFrameElement).contentWindow, origin })));
}
afterEach(() => { cleanup(); localStorage.clear(); vi.restoreAllMocks(); });

describe('lesson host bridge', () => {
  it('initializes only its opaque iframe and ignores messages from another window', () => {
    render(<Harness />);
    const iframe = screen.getByTitle('Lesson') as HTMLIFrameElement;
    const send = vi.spyOn(iframe.contentWindow!, 'postMessage');
    message({ type: 'ready' }, window);
    message({ type: 'ready' }, iframe.contentWindow, location.origin);
    expect(send).not.toHaveBeenCalled();
    message({ type: 'ready' });
    expect(send).toHaveBeenCalledWith({ ...envelope, type: 'init', state: { readingScale: 100, answers: {} }, visible: true }, '*');
    expect(screen.getByText('intro:100')).toBeInTheDocument();
  });
  it('rejects uninitialized, malformed and unknown navigation/state messages', () => {
    render(<Harness />);
    message({ type: 'section', sectionId: 'path' });
    message({ type: 'ready', secret: 'unexpected' });
    expect(screen.getByText('loading:100')).toBeInTheDocument();
    message({ type: 'ready' });
    message({ type: 'section', sectionId: 'not-in-manifest' });
    message({ type: 'state', state: { readingScale: 10, answers: {} } });
    expect(screen.getByText('intro:100')).toBeInTheDocument();
    message({ type: 'section', sectionId: 'path' });
    expect(screen.getByText('path:100')).toBeInTheDocument();
  });
  it('persists only declared questions and the scale, never arbitrary host storage', () => {
    render(<Harness />);
    message({ type: 'ready' });
    message({ type: 'state', state: { readingScale: 90, answers: { motion: 'incorrect', other: 'correct' } } });
    expect(restoreReaderState(localStorage.getItem(readerStorageKey('alice', artifact.manifest)), artifact.manifest)).toEqual({ readingScale: 90, answers: { motion: 'incorrect' } });
    expect(localStorage.length).toBe(1);
  });
});
