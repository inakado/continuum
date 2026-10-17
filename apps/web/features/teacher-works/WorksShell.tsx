"use client";
import Link from 'next/link';
import ContinuumHeader from '@/components/ContinuumHeader';
import styles from './teacher-works.module.css';

export default function WorksShell({ children, canLeave }: { children: React.ReactNode; canLeave?: () => boolean }) {
  return <div className={styles.page} onClickCapture={(event) => {
    if (canLeave && (event.target as HTMLElement).closest('a[href]') && !canLeave()) event.preventDefault();
  }}><ContinuumHeader homeHref="/teacher" /><nav className={styles.nav} aria-label="Разделы учителя"><Link href="/teacher/materials">Материалы</Link><Link href="/teacher/students">Ученики и доступы</Link><Link href="/teacher/bank">Банк заданий</Link><Link href="/teacher/works" aria-current="page">Работы</Link></nav><main className={styles.main}>{children}</main></div>;
}
