'use client';

import { lessonReadingTop, useLessonEnvironment } from '@/components/interactive-lesson/authoring/LessonEnvironment';
import { useCallback, useLayoutEffect, useRef, useState, type RefObject } from 'react';

export const READING_SCALE_KEY = 'continuum:prototype:reading-scale:v1';
const validScale = (value: number) => Number.isInteger(value) && value >= 80 && value <= 120 && value % 10 === 0;

export function useLessonReadingScale(root: RefObject<HTMLElement | null>, articleId?: string) {
  const environment = useLessonEnvironment();
  const [scale, setScale] = useState(100);
  const [minimum, setMinimum] = useState(80);
  const preferred = useRef(100);
  const current = useRef(100);
  const min = useRef(80);
  const frame = useRef(0);
  const article = useRef<HTMLElement | null>(null);

  const apply = useCallback((value: number) => {
    const target = article.current;
    if (!target || value === current.current) return;
    cancelAnimationFrame(frame.current);
    const anchor = [...target.querySelectorAll<HTMLElement>('p, h1, h2, h3, figure, [data-equation-number]')]
      .find((node) => {
        if (node.closest('[data-reading-question]')) return false;
        const box = node.getBoundingClientRect();
        return box.bottom > lessonReadingTop() + 24 && box.top < innerHeight;
      });
    const top = anchor?.getBoundingClientRect().top ?? 0;
    target.style.overflowAnchor = 'none';
    target.style.setProperty('--lesson-reading-scale', String(value / 100));
    target.dataset.readingScale = String(value);
    current.current = value;
    setScale(value);
    // Два кадра дают MathJax и браузеру закончить перерасчёт потока.
    const restore = () => {
      if (!anchor?.isConnected) return;
      const delta = anchor.getBoundingClientRect().top - top;
      if (Math.abs(delta) > .5) window.scrollBy({ top: delta, behavior: 'instant' });
    };
    frame.current = requestAnimationFrame(() => {
      restore();
      frame.current = requestAnimationFrame(() => { restore(); target.style.removeProperty('overflow-anchor'); });
    });
  }, []);

  useLayoutEffect(() => {
    article.current = articleId ? document.getElementById(articleId) : root.current?.closest('article') ?? null;
    const media = window.matchMedia('(max-width: 760px)');
    try {
      const saved = Number(environment ? environment.state.readingScale : localStorage.getItem(READING_SCALE_KEY));
      if (validScale(saved)) preferred.current = saved;
    } catch { /* При недоступном storage выбор действует до ухода со страницы. */ }
    const resize = () => {
      min.current = media.matches ? 90 : 80;
      setMinimum(min.current);
      apply(Math.max(min.current, preferred.current));
    };
    const fromHost = (event: Event) => {
      const value = (event as CustomEvent<number>).detail;
      if (validScale(value)) { preferred.current = value; apply(Math.max(min.current, value)); environment?.setReadingScale(value); }
    };
    resize();
    window.addEventListener('lessonscalechange', fromHost);
    media.addEventListener('change', resize);
    return () => {
      media.removeEventListener('change', resize);
      window.removeEventListener('lessonscalechange', fromHost);
      cancelAnimationFrame(frame.current);
      article.current?.style.removeProperty('overflow-anchor');
    };
  }, [root, articleId, apply]);

  function change(value: number) {
    const next = Math.max(min.current, Math.min(120, value));
    preferred.current = next;
    apply(next);
    try { if (environment) environment.setReadingScale(next); else localStorage.setItem(READING_SCALE_KEY, String(next)); } catch { /* Сохраняем работу без storage. */ }
  }
  return { scale, minimum, decrease: () => change(current.current - 10), increase: () => change(current.current + 10), reset: () => change(100) };
}
