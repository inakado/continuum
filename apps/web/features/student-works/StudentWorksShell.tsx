"use client";
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useRef, type ReactNode } from 'react';
import ContinuumHeader from '@/components/ContinuumHeader';
import { useStudentMobile } from './use-student-mobile';
import styles from './student-works.module.css';

export function StudentNavigation({ active }: { active: 'materials' | 'works' }) {
  return <nav className={styles.nav} aria-label="Разделы ученика"><Link href="/student" aria-current={active === 'materials' ? 'page' : undefined}>Материалы</Link><Link href="/student/works" aria-current={active === 'works' ? 'page' : undefined}>Работы</Link></nav>;
}
export function StudentChrome({ active, beforeLogout }: { active: 'materials' | 'works'; beforeLogout?: () => Promise<boolean> }) {
  return <div className={styles.chrome}><ContinuumHeader homeHref="/student" beforeLogout={beforeLogout} /><StudentNavigation active={active} /></div>;
}
export default function StudentWorksShell({ children, beforeLeave, mobileHeader }: { children: ReactNode; beforeLeave?: () => Promise<boolean>; mobileHeader?: ReactNode }) {
  const mobile = useStudentMobile();
  const router = useRouter();
  const navigating = useRef(false);
  return <div className={`${styles.page} ${mobileHeader ? styles.playerPage : ''}`} onClickCapture={(event) => {
    const link = (event.target as HTMLElement).closest<HTMLAnchorElement>('a[href]');
    if (!beforeLeave || !link || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || link.target === '_blank' || link.hasAttribute('download')) return;
    event.preventDefault(); event.stopPropagation();
    if (navigating.current) return;
    navigating.current = true;
    const url = new URL(link.href);
    void beforeLeave().then((allowed) => { if (allowed) { if (url.origin === location.origin) router.push(url.pathname + url.search + url.hash); else location.assign(url.href); } }).finally(() => { navigating.current = false; });
  }}>
    {mobile && mobileHeader ? mobileHeader : <StudentChrome active="works" beforeLogout={beforeLeave} />}<main className={styles.main}>{children}</main>
  </div>;
}
