"use client";
import { useRouter } from 'next/navigation';
import TeacherChrome from '@/features/teacher-shell/TeacherChrome';
import styles from './teacher-works.module.css';

export default function WorksShell({ children, beforeLeave, active = 'works', mainClassName = '' }: { children: React.ReactNode; beforeLeave?: () => Promise<boolean>; active?: 'works' | 'statistics'; mainClassName?: string }) {
  const router = useRouter();
  return <div className={styles.page} onClickCapture={(event) => {
    if (!beforeLeave || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const link = (event.target as HTMLElement).closest<HTMLAnchorElement>('a[href]');
    if (!link || (link.target && link.target !== '_self') || link.hasAttribute('download')) return;
    event.preventDefault();
    void beforeLeave().then((allowed) => { if (allowed) { if (link.origin === window.location.origin) router.push(`${link.pathname}${link.search}${link.hash}`); else window.location.assign(link.href); } });
  }}><TeacherChrome active={active} beforeLogout={beforeLeave} /><main className={`${styles.main} ${mainClassName}`}>{children}</main></div>;
}
