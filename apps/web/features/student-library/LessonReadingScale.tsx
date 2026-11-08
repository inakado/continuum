'use client';

import { useRef } from 'react';
import { Minus, Plus } from 'lucide-react';
import { useLessonReadingScale } from './useLessonReadingScale';
import styles from './student-interactive-lesson-prototype.module.css';

export default function LessonReadingScale({ articleId }: { articleId?: string }) {
  const root = useRef<HTMLDivElement>(null);
  const reading = useLessonReadingScale(root, articleId);
  return <div ref={root} className={styles.readingScale} role="group" aria-label="Масштаб чтения">
    <button type="button" onClick={reading.decrease} disabled={reading.scale <= reading.minimum} aria-label="Уменьшить масштаб текста" title="Уменьшить текст"><Minus size={16} aria-hidden="true" /></button>
    <button type="button" onClick={reading.reset} className={styles.scaleReset} aria-label="Сбросить масштаб до 100%" title="Обычный размер: 100%"><output aria-live="polite" aria-atomic="true">{reading.scale}%</output></button>
    <button type="button" onClick={reading.increase} disabled={reading.scale >= 120} aria-label="Увеличить масштаб текста" title="Увеличить текст"><Plus size={16} aria-hidden="true" /></button>
  </div>;
}
