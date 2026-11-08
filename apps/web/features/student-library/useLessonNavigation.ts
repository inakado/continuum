'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { lessonSections } from './lesson-navigation';

export function useLessonNavigation(sections: readonly { id: string; title: string }[] = lessonSections, articleId = 'kinematics-lesson') {
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState<string>(sections[0].id);
  const [open, setOpen] = useState(false);
  const position = useCallback(() => {
    if (!trigger.current || !panel.current) return;
    const box = trigger.current.getBoundingClientRect();
    const top = (trigger.current.closest('header')?.getBoundingClientRect().bottom ?? box.bottom) + 8;
    const width = Math.min(320, innerWidth - 32);
    panel.current.style.left = `${Math.max(16, Math.min(box.left, innerWidth - width - 16))}px`;
    panel.current.style.setProperty('--lesson-menu-top', `${top}px`);
  }, []);

  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      const readingTop = (trigger.current?.closest('header')?.getBoundingClientRect().bottom ?? 64) + 24;
      let id: string = sections[0].id;
      for (const section of sections) {
        const node = document.getElementById(section.id);
        if (node && node.getBoundingClientRect().top <= readingTop + 1) id = section.id;
      }
      setActive(id);
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(update); };
    const resize = () => { position(); schedule(); };
    const observer = new ResizeObserver(schedule);
    const article = document.getElementById(articleId);
    if (article) observer.observe(article);
    schedule();
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', resize);
    return () => { cancelAnimationFrame(frame); observer.disconnect(); window.removeEventListener('scroll', schedule); window.removeEventListener('resize', resize); };
  }, [position, sections, articleId]);

  function toggle() {
    const visible = panel.current?.matches(':popover-open') ?? false;
    setOpen(visible);
    if (visible) {
      position();
      const current = panel.current?.querySelector<HTMLAnchorElement>('[aria-current="location"]');
      current?.focus({ preventScroll: true });
      current?.scrollIntoView({ block: 'nearest' });
    }
  }
  function select(id: string) {
    setActive(id);
    const target = document.getElementById(id);
    panel.current?.hidePopover();
    if (target) {
      if (!target.hasAttribute('tabindex')) {
        target.setAttribute('tabindex', '-1');
        target.addEventListener('blur', () => target.removeAttribute('tabindex'), { once: true });
      }
      target.focus({ preventScroll: true });
    }
  }
  return { trigger, panel, active, open, toggle, select, position };
}
