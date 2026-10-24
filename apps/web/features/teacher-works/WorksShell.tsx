"use client";
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import ContinuumHeader from '@/components/ContinuumHeader';
import styles from './teacher-works.module.css';

export default function WorksShell({ children, beforeLeave, active = 'works', mainClassName = '' }: { children: React.ReactNode; beforeLeave?: () => Promise<boolean>; active?: 'works' | 'statistics'; mainClassName?: string }) {
  const router = useRouter();
  return <div className={styles.page} onClickCapture={(event) => {
    if (!beforeLeave || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const link = (event.target as HTMLElement).closest<HTMLAnchorElement>('a[href]');
    if (!link || (link.target && link.target !== '_self') || link.hasAttribute('download')) return;
    event.preventDefault();
    void beforeLeave().then((allowed) => { if (allowed) { if (link.origin === window.location.origin) router.push(`${link.pathname}${link.search}${link.hash}`); else window.location.assign(link.href); } });
  }}><ContinuumHeader homeHref="/teacher" beforeLogout={beforeLeave} /><nav className={styles.nav} aria-label="Разделы учителя"><Link href="/teacher/materials">Материалы</Link><Link href="/teacher/students">Ученики и доступы</Link><Link href="/teacher/bank">Банк заданий</Link><Link href="/teacher/works" aria-current={active === 'works' ? 'page' : undefined}>Работы</Link><Link href="/teacher/statistics" aria-current={active === 'statistics' ? 'page' : undefined}>Статистика</Link></nav><main className={`${styles.main} ${mainClassName}`}>{children}</main></div>;
}
