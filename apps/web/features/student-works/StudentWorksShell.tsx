"use client";
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useRef } from 'react';
import ContinuumHeader from '@/components/ContinuumHeader';
import styles from './student-works.module.css';

export function StudentNavigation({ active }: { active: 'materials' | 'works' }) {
  return <nav className={styles.nav} aria-label="Разделы ученика"><Link href="/student" aria-current={active === 'materials' ? 'page' : undefined}>Материалы</Link><Link href="/student/works" aria-current={active === 'works' ? 'page' : undefined}>Работы</Link></nav>;
}
export default function StudentWorksShell({ children, beforeLeave }: { children: React.ReactNode; beforeLeave?: () => Promise<boolean> }) {
  const router = useRouter();
  const navigating = useRef(false);
  return <div className={styles.page} onClickCapture={(event) => {
    const link = (event.target as HTMLElement).closest<HTMLAnchorElement>('a[href]');
    if (!beforeLeave || !link || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || link.target === '_blank' || link.hasAttribute('download')) return;
    event.preventDefault(); event.stopPropagation();
    if (navigating.current) return;
    navigating.current = true;
    const url = new URL(link.href);
    void beforeLeave().then((allowed) => { if (allowed) { if (url.origin === location.origin) router.push(url.pathname + url.search + url.hash); else location.assign(url.href); } }).finally(() => { navigating.current = false; });
  }}>
    <ContinuumHeader homeHref="/student" beforeLogout={beforeLeave} /><StudentNavigation active="works" /><main className={styles.main}>{children}</main>
  </div>;
}
