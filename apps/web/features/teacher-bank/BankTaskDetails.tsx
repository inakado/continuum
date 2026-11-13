"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import styles from './bank-workspace.module.css';

export default function BankTaskDetails({ answer, metadata, hasSolution }: { answer: ReactNode; metadata: ReactNode; hasSolution: boolean }) {
  const [open, setOpen] = useState<'answer' | 'metadata' | null>(null);
  const details = useRef<HTMLElement>(null);
  const id = useId();
  useEffect(() => {
    if (open) details.current?.scrollIntoView({ block: 'start', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
  }, [open]);
  const sections = [
    ...(answer ? [{ key: 'answer' as const, label: hasSolution ? 'Ответ и решение' : 'Ответ', content: answer }] : []),
    { key: 'metadata' as const, label: 'Метаданные', content: metadata },
  ];
  return <section ref={details} className={styles.taskDetails} aria-label="Ответ и информация о задаче">
    <div className={styles.detailActions}>{sections.map(({ key, label }) => <button key={key} type="button" id={`${id}-${key}-button`} aria-expanded={open === key} aria-controls={`${id}-${key}`} onClick={() => setOpen(open === key ? null : key)}>{label}<ChevronDown size={14} aria-hidden="true" /></button>)}</div>
    {sections.map(({ key, content }) => <div key={key} className={styles.detailPanel} id={`${id}-${key}`} role="region" aria-labelledby={`${id}-${key}-button`} hidden={open !== key}>{open === key && content}</div>)}
  </section>;
}
