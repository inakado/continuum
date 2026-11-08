import { useEffect, useRef, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { HostToLessonMessageSchema, type LessonReaderState, type LessonToHostMessage } from '@continuum/shared';
import LessonArticle from './LessonArticle';
import { LessonEnvironmentProvider, LessonFormulaProvider, type LessonEnvironment } from './LessonEnvironment';
import { useLessonReadingScale } from './useLessonReadingScale';
import type { LessonDefinition } from './lesson-definition';

function RuntimeControllers({ definition }: { definition: LessonDefinition }) {
  const root = useRef<HTMLDivElement>(null);
  useLessonReadingScale(root, definition.articleId);
  useEffect(() => observeSection(definition), [definition]);
  return null;
}
type Payload<T> = T extends unknown ? Omit<T, 'channel' | 'version'> : never;
const send = (message: Payload<LessonToHostMessage>) => {
  window.parent.postMessage({ channel: 'continuum.lesson', version: 1, ...message }, '*');
};
function visibility(visible: boolean) {
  document.documentElement.dataset.lessonHostVisible = String(visible);
  document.dispatchEvent(new Event('lessonvisibilitychange'));
}
function navigate(definition: LessonDefinition, id: string) {
  if (!definition.sections.some(section => section.id === id)) return;
  const target = document.getElementById(id);
  if (!target) return;
  target.scrollIntoView({ block: 'start', behavior: 'instant' });
  if (!target.hasAttribute('tabindex')) {
    target.setAttribute('tabindex', '-1');
    target.addEventListener('blur', () => target.removeAttribute('tabindex'), { once: true });
  }
  target.focus({ preventScroll: true });
}
function observeSection(definition: LessonDefinition) {
  let frame = 0, previous = '';
  const update = () => {
    frame = 0;
    let current = definition.sections[0].id;
    for (const section of definition.sections) {
      if ((document.getElementById(section.id)?.getBoundingClientRect().top ?? Infinity) <= 25) current = section.id;
    }
    if (current !== previous) { previous = current; send({ type: 'section', sectionId: current }); }
  };
  const schedule = () => { if (!frame) frame = requestAnimationFrame(update); };
  window.addEventListener('scroll', schedule, { passive: true });
  window.addEventListener('resize', schedule);
  const observer = new ResizeObserver(schedule);
  const article = document.getElementById(definition.articleId);
  if (article) observer.observe(article);
  schedule();
  return () => {
    cancelAnimationFrame(frame); observer.disconnect();
    window.removeEventListener('scroll', schedule); window.removeEventListener('resize', schedule);
  };
}

export function mountLesson(definition: LessonDefinition, formula: (tex: string, display: boolean) => ReactNode) {
  const root = createRoot(document.getElementById('lesson-root')!);
  let environment: LessonEnvironment | undefined;
  const emitState = () => { if (environment) send({ type: 'state', state: environment.state }); };
  let attempts = 0;
  const ready = () => { if (!environment && attempts++ < 120) send({ type: 'ready' }); };
  const timer = setInterval(ready, 500);
  const receive = (event: MessageEvent) => {
    if (event.source !== window.parent) return;
    const message = HostToLessonMessageSchema.safeParse(event.data);
    if (!message.success) return;
    const data = message.data;
    if (data.type === 'init') {
      // A repeated ready/init handshake must not reset a running demonstration.
      if (environment) return;
      clearInterval(timer);
      const allowed = new Set(definition.questions.map(question => question.id));
      const state: LessonReaderState = { readingScale: data.state.readingScale, answers: Object.fromEntries(Object.entries(data.state.answers).filter(([id]) => allowed.has(id))) };
      environment = { state,
        saveAnswer(id, answer) { if (allowed.has(id)) { state.answers[id] = answer; emitState(); } },
        setReadingScale(value) { state.readingScale = value as LessonReaderState['readingScale']; emitState(); },
      };
      visibility(data.visible);
      root.render(<LessonEnvironmentProvider value={environment}><LessonFormulaProvider value={formula}>
        <LessonArticle definition={definition} /><RuntimeControllers definition={definition} />
      </LessonFormulaProvider></LessonEnvironmentProvider>);
      emitState();
    } else if (environment && data.type === 'navigate') navigate(definition, data.sectionId);
    else if (environment && data.type === 'scale') window.dispatchEvent(new CustomEvent('lessonscalechange', { detail: data.value }));
    else if (environment && data.type === 'visibility') visibility(data.visible);
  };
  window.addEventListener('message', receive);
  ready();
  return () => { clearInterval(timer); window.removeEventListener('message', receive); root.unmount(); };
}
