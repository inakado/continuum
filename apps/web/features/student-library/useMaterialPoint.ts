'use client';

import { lessonHostVisible } from '@/components/interactive-lesson/authoring/LessonEnvironment';
import { useCallback, useEffect, useRef, useState } from 'react';
import { APERTURE_DURATION, materialPointCaption, materialPointFrame, type MaterialPointLayout, type MaterialPointMode } from './material-point-model';
import type { PointView } from './point-position-model';

export function useMaterialPoint(layout: MaterialPointLayout, view: PointView) {
  const root = useRef<HTMLElement>(null);
  const carriage = useRef<SVGGElement>(null);
  const point = useRef<SVGCircleElement>(null);
  const trail = useRef<SVGPathElement>(null);
  const back = useRef<SVGGElement>(null);
  const backBlocked = useRef<SVGGElement>(null);
  const front = useRef<SVGGElement>(null);
  const beam = useRef<(SVGPathElement | null)[]>([]);
  const openingMeasure = useRef<SVGPathElement>(null);
  const caption = useRef<HTMLElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const output = useRef<HTMLOutputElement>(null);
  const state = useRef({ progress: 0, opening: layout.opening.initial, interacted: false, scale: 1 });
  const retry = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [mode, setMode] = useState<MaterialPointMode>('motion');
  const [playing, setPlaying] = useState(false);
  const [finished, setFinished] = useState(false);
  const [abstracted, setAbstracted] = useState(false);

  const paint = useCallback((currentMode = mode) => {
    const frame = materialPointFrame(currentMode, state.current.progress, state.current.opening, layout, view);
    carriage.current?.setAttribute('transform', `translate(${frame.translation.join(' ')})`);
    point.current?.setAttribute('cx', String(frame.point[0]));
    point.current?.setAttribute('cy', String(frame.point[1]));
    point.current?.setAttribute('r', String(4 / state.current.scale));
    trail.current?.setAttribute('d', frame.trail);
    for (const node of [back.current, backBlocked.current]) node?.setAttribute('transform', `translate(${-frame.postShift[0]} ${-frame.postShift[1]})`);
    front.current?.setAttribute('transform', `translate(${frame.postShift.join(' ')})`);
    [frame.beam.top, frame.beam.side, frame.beam.front].forEach((d, i) => beam.current[i]?.setAttribute('d', d));
    openingMeasure.current?.setAttribute('d', frame.openingLine);
    if (root.current) {
      root.current.dataset.clearance = frame.fit;
      root.current.dataset.phase = frame.passage?.phase ?? 'motion';
      root.current.dataset.center = String(frame.center);
    }
    const message = materialPointCaption(currentMode, state.current.opening, layout, state.current.progress);
    if (caption.current && caption.current.textContent !== message) caption.current.textContent = message;
    const metres = (frame.opening / layout.worldUnitsPerMetre).toFixed(2).replace('.', ',');
    if (input.current) { input.current.value = String(frame.opening); input.current.setAttribute('aria-valuetext', `${metres} м`); }
    if (output.current) output.current.textContent = `${metres} м`;
    return frame;
  }, [mode, layout, view]);

  useEffect(() => () => clearTimeout(retry.current), []);

  useEffect(() => {
    const resize = new ResizeObserver(() => {
      state.current.scale = (root.current?.querySelector('svg')?.getBoundingClientRect().width ?? 900) / 900 || 1;
      paint();
    });
    if (root.current) resize.observe(root.current);
    paint();
    return () => resize.disconnect();
  }, [paint]);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const observer = new IntersectionObserver((entries) => {
      clearTimeout(timer);
      const entry = entries[entries.length - 1];
      if (entry.isIntersecting && entry.intersectionRatio >= .5 && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        timer = setTimeout(() => {
          if (!state.current.interacted && !document.hidden && lessonHostVisible()) {
            state.current.interacted = true;
            setAbstracted(true);
            setPlaying(true);
          }
        }, 900);
      }
    }, { threshold: .5 });
    if (root.current) observer.observe(root.current);
    return () => { clearTimeout(timer); observer.disconnect(); };
  }, []);

  useEffect(() => {
    if (!playing) return;
    let frame = 0, last = 0, visible = false;
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const tick = (now: number) => {
      const dt = last ? Math.min((now - last) / 1000, 1 / 30) : 0;
      last = now;
      state.current.progress = Math.min(1, state.current.progress + dt / (mode === 'aperture' ? APERTURE_DURATION : 5.5));
      const current = paint();
      if (state.current.progress === 1 || current.passage?.finished) {
        state.current.progress = 1; paint(); setPlaying(false); setFinished(true);
      }
      else frame = requestAnimationFrame(tick);
    };
    const reconcile = () => {
      cancelAnimationFrame(frame);
      last = 0;
      if (visible && !document.hidden && lessonHostVisible() && !media.matches) frame = requestAnimationFrame(tick);
      if (media.matches) setPlaying(false);
    };
    const observer = new IntersectionObserver((entries) => { visible = entries[entries.length - 1].isIntersecting; reconcile(); }, { threshold: .15 });
    if (root.current) observer.observe(root.current);
    document.addEventListener('visibilitychange', reconcile);
    document.addEventListener('lessonvisibilitychange', reconcile);
    media.addEventListener('change', reconcile);
    return () => { cancelAnimationFrame(frame); observer.disconnect(); document.removeEventListener('visibilitychange', reconcile); document.removeEventListener('lessonvisibilitychange', reconcile); media.removeEventListener('change', reconcile); };
  }, [mode, playing, paint]);

  function choose(next: MaterialPointMode) {
    clearTimeout(retry.current);
    state.current.interacted = true;
    state.current.progress = 0;
    setPlaying(false);
    setFinished(false);
    setMode(next);
    if (next === 'motion') setAbstracted(true);
    paint(next);
    if (next === 'aperture' && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) retry.current = setTimeout(() => setPlaying(true), 350);
  }

  function toggle() {
    clearTimeout(retry.current);
    state.current.interacted = true;
    setAbstracted(true);
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      state.current.progress = state.current.progress === 1 ? 0 : 1;
      setFinished(state.current.progress === 1);
      paint();
    } else {
      if (state.current.progress === 1) { state.current.progress = 0; setFinished(false); paint(); }
      setPlaying((value) => !value);
    }
  }

  function changeOpening(value: number) {
    clearTimeout(retry.current);
    state.current.interacted = true;
    state.current.opening = value; state.current.progress = 0;
    setPlaying(false); setFinished(false); paint();
    if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) retry.current = setTimeout(() => setPlaying(true), 350);
  }
  return { root, carriage, point, trail, back, backBlocked, front, beam, openingMeasure, caption, input, output, mode, playing, finished, abstracted, choose, toggle, changeOpening };
}
