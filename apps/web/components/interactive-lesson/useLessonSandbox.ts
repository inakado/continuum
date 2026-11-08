'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { LessonToHostMessageSchema, type HostToLessonMessage, type InteractiveLessonDocument, type LessonReaderState } from '@continuum/shared';
import { filterReaderState, readerStorageKey, restoreReaderState, serializeReaderState } from './lesson-sandbox';

export function useLessonSandbox(artifact: InteractiveLessonDocument, storageScope: string) {
  const frame = useRef<HTMLIFrameElement>(null);
  const stateRef = useRef<LessonReaderState>({ readingScale: 100, answers: {} });
  const [state, setState] = useState(stateRef.current);
  const [active, setActive] = useState(artifact.manifest.sections[0].id);
  const [ready, setReady] = useState(false);
  const [timedOut, setTimedOut] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const manifest = artifact.manifest;

  const send = useCallback((message: HostToLessonMessage) => {
    // Opaque-origin sandbox documents have no targetable origin. Never send
    // credentials, identity or arbitrary host storage through this bridge.
    frame.current?.contentWindow?.postMessage(message, '*');
  }, []);

  useEffect(() => {
    const key = readerStorageKey(storageScope, manifest);
    let initial: string | null = null;
    try { initial = localStorage.getItem(key); } catch { /* Storage is optional. */ }
    stateRef.current = restoreReaderState(initial, manifest);
    setState(stateRef.current);
    setReady(false);
    setTimedOut(false);
    let initialized = false;
    const timeout = setTimeout(() => { if (!initialized) setTimedOut(true); }, 20_000);
    const receive = (event: MessageEvent) => {
      if (!frame.current?.contentWindow || event.source !== frame.current.contentWindow || event.origin !== 'null') return;
      const parsed = LessonToHostMessageSchema.safeParse(event.data);
      if (!parsed.success) return;
      const message = parsed.data;
      if (message.type === 'ready') {
        send({ channel: 'continuum.lesson', version: 1, type: 'init', state: stateRef.current, visible: !document.hidden });
        initialized = true;
        clearTimeout(timeout);
        setTimedOut(false);
        setReady(true);
      } else if (initialized && message.type === 'section') {
        if (manifest.sections.some(({ id }) => id === message.sectionId)) setActive(message.sectionId);
      } else if (initialized && message.type === 'state') {
        const next = filterReaderState(message.state, manifest);
        stateRef.current = next;
        setState(next);
        try { localStorage.setItem(key, serializeReaderState(next, manifest)); } catch { /* The current visit still works. */ }
      }
    };
    const visibility = () => send({ channel: 'continuum.lesson', version: 1, type: 'visibility', visible: !document.hidden });
    window.addEventListener('message', receive);
    document.addEventListener('visibilitychange', visibility);
    return () => { clearTimeout(timeout); window.removeEventListener('message', receive); document.removeEventListener('visibilitychange', visibility); };
  }, [manifest, storageScope, attempt, send]);

  function navigate(sectionId: string) {
    if (!manifest.sections.some(({ id }) => id === sectionId)) return;
    send({ channel: 'continuum.lesson', version: 1, type: 'navigate', sectionId });
    frame.current?.focus({ preventScroll: true });
  }
  function scale(value: number) {
    if (![80, 90, 100, 110, 120].includes(value)) return;
    send({ channel: 'continuum.lesson', version: 1, type: 'scale', value: value as LessonReaderState['readingScale'] });
  }
  return { frame, state, active, ready, timedOut, attempt, navigate, scale, retry: () => setAttempt(value => value + 1) };
}
