'use client';

import { lessonHostVisible } from '@/components/interactive-lesson/authoring/LessonEnvironment';
import { useCallback, useEffect, useRef, useState } from 'react';
import { MOTION_DURATION, MOTION_START, motionAt, motionNumber } from './motion-model';
import { axisFrameAt, type CoordinateAxis } from './motion-axis';

export function useMotionDemonstration(travel: readonly [number, number], axis: CoordinateAxis) {
  const root = useRef<HTMLElement>(null);
  const carriage = useRef<SVGGElement>(null);
  const slider = useRef<HTMLInputElement>(null);
  const clock = useRef<HTMLOutputElement>(null);
  const axisProgress = useRef<SVGPathElement>(null);
  const projection = useRef<SVGPathElement>(null);
  const axisMarker = useRef<SVGCircleElement>(null);
  const time = useRef(0);
  const interacted = useRef(false);
  const [playing, setPlaying] = useState(false);
  const [finished, setFinished] = useState(false);

  const paint = useCallback((seconds: number, announce = false) => {
    const state = motionAt(seconds);
    time.current = state.time;
    const offset = state.position - MOTION_START;
    carriage.current?.setAttribute('transform', `translate(${travel[0] * offset} ${travel[1] * offset})`);
    const frame = axisFrameAt(state.position, travel, axis);
    axisProgress.current?.setAttribute('d', frame.progress);
    projection.current?.setAttribute('d', frame.projection);
    axisMarker.current?.setAttribute('cx', String(frame.marker[0]));
    axisMarker.current?.setAttribute('cy', String(frame.marker[1]));
    if (clock.current) clock.current.textContent = `${motionNumber(state.time)} с`;
    if (slider.current) {
      slider.current.value = String(state.time);
      // Keep spoken values out of the animation loop.
      if (announce) slider.current.setAttribute('aria-valuetext', `${motionNumber(state.time)} с; координата x ${motionNumber(state.position)} м`);
    }
    return state;
  }, [travel, axis]);

  // One quiet preview on arrival; never restart after the reader takes control.
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const observer = new IntersectionObserver((entries) => {
      clearTimeout(timer);
      if (entries[entries.length - 1].isIntersecting && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        timer = setTimeout(() => {
          if (!interacted.current && !document.hidden && lessonHostVisible()) {
            interacted.current = true;
            setPlaying(true);
          }
        }, 1400);
      }
    }, { threshold: 0.5 });
    if (root.current) observer.observe(root.current);
    return () => { clearTimeout(timer); observer.disconnect(); };
  }, []);

  useEffect(() => {
    if (!playing) return;
    let frame = 0;
    let last = 0;
    let visible = false;
    const still = window.matchMedia('(prefers-reduced-motion: reduce)');
    const tick = (now: number) => {
      const elapsed = last ? Math.min((now - last) / 1000, 1 / 30) : 0;
      last = now;
      const state = paint(time.current + elapsed);
      if (state.finished) {
        paint(state.time, true);
        setFinished(true);
        setPlaying(false);
      } else frame = requestAnimationFrame(tick);
    };
    const reconcile = () => {
      cancelAnimationFrame(frame);
      last = 0;
      if (visible && !document.hidden && lessonHostVisible() && !still.matches) frame = requestAnimationFrame(tick);
      if (still.matches) setPlaying(false);
    };
    const observer = new IntersectionObserver((entries) => {
      visible = entries[entries.length - 1].isIntersecting;
      reconcile();
    }, { threshold: 0.15 });
    if (root.current) observer.observe(root.current);
    document.addEventListener('visibilitychange', reconcile);
    document.addEventListener('lessonvisibilitychange', reconcile);
    still.addEventListener('change', reconcile);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      document.removeEventListener('visibilitychange', reconcile); document.removeEventListener('lessonvisibilitychange', reconcile);
      still.removeEventListener('change', reconcile);
    };
    // DOM-only animation; React changes only on play/pause/end, not every frame.
  }, [playing, paint]);

  function seek(seconds: number) {
    interacted.current = true;
    setPlaying(false);
    setFinished(paint(seconds, true).finished);
  }

  function toggle() {
    interacted.current = true;
    if (time.current >= MOTION_DURATION) {
      paint(0, true);
      setFinished(false);
    } else paint(time.current, true);
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      seek(time.current + 1);
      return;
    }
    setPlaying((value) => !value);
  }

  return { root, carriage, slider, clock, axisProgress, projection, axisMarker, playing, finished, seek, toggle };
}
