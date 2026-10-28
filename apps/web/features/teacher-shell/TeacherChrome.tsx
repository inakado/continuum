"use client";

import { useEffect, useRef } from 'react';
import Link from 'next/link';
import ContinuumHeader from '@/components/ContinuumHeader';
import styles from './teacher-chrome.module.css';

const sections = [
  { id: 'materials', href: '/teacher/materials', label: 'Материалы' },
  { id: 'students', href: '/teacher/students', label: 'Ученики и доступы' },
  { id: 'bank', href: '/teacher/bank', label: 'Банк заданий' },
  { id: 'works', href: '/teacher/works', label: 'Работы' },
  { id: 'statistics', href: '/teacher/statistics', label: 'Статистика' },
] as const;

export default function TeacherChrome({ active, beforeLogout }: { active?: (typeof sections)[number]['id']; beforeLogout?: () => Promise<boolean> }) {
  const navigation = useRef<HTMLElement>(null);
  useEffect(() => {
    const nav = navigation.current;
    const current = nav?.querySelector<HTMLElement>('[aria-current="page"]');
    if (!nav || !current) return;
    // Прокручивается только горизонтальная навигация, положение страницы сохраняется.
    const showActive = () => { nav.scrollLeft = Math.max(0, current.offsetLeft - nav.offsetLeft - 20); };
    showActive();
    window.addEventListener('resize', showActive);
    return () => window.removeEventListener('resize', showActive);
  }, [active]);
  return <div className={styles.chrome}>
    <ContinuumHeader homeHref="/teacher" beforeLogout={beforeLogout} />
    <nav ref={navigation} className={styles.nav} aria-label="Разделы учителя">
      {sections.map((section) => <Link key={section.id} href={section.href} aria-current={section.id === active ? 'page' : undefined}>{section.label}</Link>)}
    </nav>
  </div>;
}
