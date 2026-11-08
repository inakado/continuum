'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { ChevronDown, Minus, Plus } from 'lucide-react';
import type { InteractiveLessonManifest } from '@continuum/shared';
import styles from './interactive-lesson.module.css';

export default function InteractiveLessonNavigation({ manifest, active, scale, onNavigate, onScale, disabled }: {
  manifest: InteractiveLessonManifest; active: string; scale: number; disabled: boolean;
  onNavigate: (id: string) => void; onScale: (value: number) => void;
}) {
  const id = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [minimum, setMinimum] = useState(80);
  const effectiveScale = Math.max(minimum, scale);
  function position() {
    if (!trigger.current || !panel.current) return;
    const box = trigger.current.getBoundingClientRect();
    const top = (trigger.current.closest('header')?.getBoundingClientRect().bottom ?? box.bottom) + 8;
    const width = Math.min(320, innerWidth - 32);
    panel.current.style.left = `${Math.max(16, Math.min(box.left, innerWidth - width - 16))}px`;
    panel.current.style.setProperty('--lesson-menu-top', `${top}px`);
  }
  useEffect(() => {
    const media = matchMedia('(max-width: 760px)');
    const update = () => { setMinimum(media.matches ? 90 : 80); position(); };
    let blurTimer = 0;
    const closeFromFrame = () => {
      clearTimeout(blurTimer);
      // Native light-dismiss does not cross the document boundary into an iframe.
      blurTimer = window.setTimeout(() => {
        if (document.activeElement instanceof HTMLIFrameElement && panel.current?.matches(':popover-open')) panel.current.hidePopover();
      }, 0);
    };
    update();
    window.addEventListener('resize', update);
    window.addEventListener('blur', closeFromFrame);
    return () => { clearTimeout(blurTimer); window.removeEventListener('resize', update); window.removeEventListener('blur', closeFromFrame); };
  }, []);
  function toggle() {
    const visible = panel.current?.matches(':popover-open') ?? false;
    setOpen(visible);
    if (visible) {
      position();
      const current = panel.current?.querySelector<HTMLButtonElement>('[aria-current="location"]');
      current?.focus({ preventScroll: true });
      current?.scrollIntoView({ block: 'nearest' });
    }
  }
  function select(sectionId: string) { panel.current?.hidePopover(); onNavigate(sectionId); }
  return <>
    <button type="button" ref={trigger} popoverTarget={id} onClick={position} className={styles.trigger} disabled={disabled} aria-label="Разделы занятия" aria-expanded={open}>Разделы<ChevronDown size={14} aria-hidden="true" /></button>
    <div id={id} ref={panel} popover="auto" onToggle={toggle} className={styles.panel} role="dialog" aria-modal="false" aria-labelledby={`${id}-title`}>
      <p id={`${id}-title`} className={styles.menuTitle}>{manifest.title}</p>
      <nav aria-label="Содержание занятия" className={styles.links}>
        {manifest.sections.map(section => <button type="button" key={section.id} onClick={() => select(section.id)} aria-current={active === section.id ? 'location' : undefined}>{section.title}</button>)}
      </nav>
      <div className={styles.scale} role="group" aria-label="Масштаб чтения">
        <button type="button" disabled={effectiveScale <= minimum} onClick={() => onScale(effectiveScale - 10)} aria-label="Уменьшить масштаб текста"><Minus size={16} aria-hidden="true" /></button>
        <button type="button" onClick={() => onScale(100)} aria-label="Сбросить масштаб текста" className={styles.scaleReset}><span aria-live="polite">{effectiveScale}%</span></button>
        <button type="button" disabled={effectiveScale >= 120} onClick={() => onScale(effectiveScale + 10)} aria-label="Увеличить масштаб текста"><Plus size={16} aria-hidden="true" /></button>
      </div>
    </div>
  </>;
}
