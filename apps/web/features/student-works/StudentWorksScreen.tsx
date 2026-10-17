"use client";
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { studentWorkQueryKeys } from '@/lib/query/keys';
import { apiErrorMessage } from '@/lib/api/error-message';
import { studentWorksApi } from './student-works.api';
import StudentWorksShell from './StudentWorksShell';
import styles from './student-works.module.css';

export default function StudentWorksScreen() {
  const query = useQuery({ queryKey: studentWorkQueryKeys.list(), queryFn: studentWorksApi.list });
  return <StudentWorksShell><div className={styles.heading}><h1>Работы</h1></div>
    {query.isPending && <p role="status">Загружаем работы…</p>}
    {query.error && <div className={styles.error} role="alert"><p>{apiErrorMessage(query.error)}</p><button className={styles.secondary} onClick={() => void query.refetch()}>Повторить</button></div>}
    {query.data?.length ? <ul className={styles.workList}>{query.data.map((item) => <li key={item.id}><Link href={`/student/works/${item.id}`}>
      <div><strong>{item.title}</strong><p>{item.status === 'completed' ? `Верно: ${item.result?.correctCount} · Неверно: ${item.result?.incorrectCount}` : item.status === 'in_progress' ? `Заполнено ${item.answeredCount} из ${item.taskCount}` : `Заданий: ${item.taskCount}`}</p></div>
      <span>{item.status === 'not_started' ? 'Начать' : item.status === 'in_progress' ? 'Продолжить' : 'Завершено'}</span>
    </Link></li>)}</ul> : query.data && <p className={styles.empty}>Назначенных работ пока нет.</p>}
  </StudentWorksShell>;
}
