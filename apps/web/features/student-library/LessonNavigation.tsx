'use client';

import { useId } from 'react';
import { ChevronDown } from 'lucide-react';
import LessonReadingScale from './LessonReadingScale';
import { lessonSections } from './lesson-navigation';
import { useLessonNavigation } from './useLessonNavigation';
import styles from './lesson-navigation.module.css';

export default function LessonNavigation({ sections = lessonSections, title = 'Основные понятия кинематики', articleId = 'kinematics-lesson' }: {
  sections?: readonly { id: string; title: string }[]; title?: string; articleId?: string;
} = {}) {
  const id = useId();
  const navigation = useLessonNavigation(sections, articleId);
  return <>
    <button ref={navigation.trigger} type="button" popoverTarget={id} onClick={navigation.position} className={styles.trigger} aria-label="Разделы занятия" aria-expanded={navigation.open}>
      Разделы<ChevronDown size={14} aria-hidden="true" />
    </button>
    <div ref={navigation.panel} id={id} popover="auto" onToggle={navigation.toggle} className={styles.panel} role="dialog" aria-modal="false" aria-labelledby={`${id}-title`}>
      <p id={`${id}-title`} className={styles.title}>{title}</p>
      <nav aria-label="Содержание занятия" className={styles.links}>
        {sections.map(({ id: section, title }) => <a key={section} href={`#${section}`} onClick={() => navigation.select(section)} aria-current={navigation.active === section ? 'location' : undefined}>{title}</a>)}
      </nav>
      <div className={styles.scale}><LessonReadingScale articleId={articleId} /></div>
    </div>
  </>;
}
