'use client';

import { lessonHostVisible } from '@/components/interactive-lesson/authoring/LessonEnvironment';
import { useCallback, useEffect, useRef, useState } from 'react';

export function useLessonPlayback(duration: number, rate: number, paint: (time: number) => void, format: (time: number) => string, initialTime = 0) {
  const root = useRef<HTMLElement>(null);
  const slider = useRef<HTMLInputElement>(null);
  const readout = useRef<HTMLOutputElement>(null);
  const time = useRef(initialTime);
  const interacted = useRef(false);
  const [playing, setPlaying] = useState(false);
  const [finished, setFinished] = useState(false);
  const update = useCallback((value: number, announce = false) => {
    const next = Math.max(0, Math.min(duration, Number.isFinite(value) ? value : 0));
    time.current = next;
    paint(next);
    if (root.current) root.current.dataset.time = next.toFixed(3);
    if (readout.current) readout.current.textContent = format(next);
    if (slider.current) {
      slider.current.value = String(next);
      if (announce) slider.current.setAttribute('aria-valuetext', format(next));
    }
    return next;
  }, [duration, paint, format]);

  useEffect(() => { update(time.current); }, [update]);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const observer = new IntersectionObserver((entries) => {
      const entry = entries[entries.length - 1];
      clearTimeout(timer);
      if (entry.intersectionRatio >= .4 && !interacted.current && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        timer = setTimeout(() => {
          if (!interacted.current && !document.hidden && lessonHostVisible()) { interacted.current = true; setPlaying(true); }
        }, 900);
      }
    }, { threshold: .4 });
    if (root.current) observer.observe(root.current);
    return () => { clearTimeout(timer); observer.disconnect(); };
  }, []);

  useEffect(() => {
    if (!playing) return;
    let frame = 0, last = 0, visible = false;
    const still = window.matchMedia('(prefers-reduced-motion: reduce)');
    const tick = (now: number) => {
      const elapsed = last ? Math.min((now - last) / 1000, .1) : 0;
      last = now;
      if (update(time.current + elapsed * rate) >= duration) {
        update(duration, true); setFinished(true); setPlaying(false);
      } else frame = requestAnimationFrame(tick);
    };
    const reconcile = () => {
      cancelAnimationFrame(frame); last = 0;
      if (visible && !document.hidden && lessonHostVisible() && !still.matches) frame = requestAnimationFrame(tick);
      if (still.matches) setPlaying(false);
    };
    const observer = new IntersectionObserver((entries) => { visible = entries[entries.length - 1].isIntersecting; reconcile(); });
    if (root.current) observer.observe(root.current);
    document.addEventListener('visibilitychange', reconcile);
    document.addEventListener('lessonvisibilitychange', reconcile);
    still.addEventListener('change', reconcile);
    return () => {
      cancelAnimationFrame(frame); observer.disconnect();
      document.removeEventListener('visibilitychange', reconcile); document.removeEventListener('lessonvisibilitychange', reconcile);
      still.removeEventListener('change', reconcile);
    };
  }, [playing, duration, rate, update]);

  function seek(value: number) {
    interacted.current = true;
    setPlaying(false);
    setFinished(update(value, true) >= duration);
  }
  function toggle() {
    interacted.current = true;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { seek(time.current >= duration ? 0 : time.current + duration / 12); return; }
    if (time.current >= duration) { update(0, true); setFinished(false); }
    update(time.current, true);
    setPlaying((value) => !value);
  }
  return { root, slider, readout, playing, finished, seek, toggle };
}
