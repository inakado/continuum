import Link from 'next/link';
import styles from './teacher-assignments.module.css';

export default function WorkTabs({ active }: { active: 'works' | 'assignments' }) {
  return <nav className={styles.tabs} aria-label="Работы и назначения">
    <Link href="/teacher/works" aria-current={active === 'works' ? 'page' : undefined}>Мои работы</Link>
    <Link href="/teacher/works/assignments" aria-current={active === 'assignments' ? 'page' : undefined}>Назначения</Link>
  </nav>;
}
