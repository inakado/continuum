"use client";
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import type { StudentWorkListItem } from '@continuum/shared';
import { solutionTaskProgress } from '@/lib/assessment/progress-labels';
import { studentWorkQueryKeys } from '@/lib/query/keys';
import { apiErrorMessage } from '@/lib/api/error-message';
import { studentWorksApi } from './student-works.api';
import StudentWorksShell from './StudentWorksShell';
import styles from './student-works.module.css';

function workAction(item: StudentWorkListItem) {
  if (item.progress.resultReady) return { label: 'Посмотреть результат', query: '?view=result' };
  if (item.status === 'not_started') return { label: 'Начать', query: '' };
  if (item.automaticTaskCount && item.status !== 'completed') return { label: 'Продолжить', query: '' };
  if (item.progress.photoTaskCount < item.extendedTaskCount) return { label: 'Добавить решения', query: '?view=solutions' };
  return { label: 'Открыть работу', query: '' };
}

function completedTestResult(item: StudentWorkListItem) {
  const result = item.result!;
  return result.points !== undefined && result.maxPoints !== undefined ? `Баллы ${result.points} из ${result.maxPoints}` : `Верно ${result.correctCount} из ${item.automaticTaskCount}`;
}

function StudentWorkRow({ item }: { item: StudentWorkListItem }) {
  const action = workAction(item);
  return <li><Link href={`/student/works/${item.id}${action.query}`}>
    <div className={styles.workIdentity}><strong>{item.title}</strong>
      {item.automaticTaskCount > 0 && <p>{item.status === 'completed' ? `Тестовая часть завершена · ${completedTestResult(item)}` : item.status === 'not_started' ? 'Тестовая часть: не начата' : `Тестовая часть: в работе · Заполнено ${item.answeredCount} из ${item.automaticTaskCount}`}</p>}
      {item.extendedTaskCount > 0 && <p>Развёрнутая часть: {solutionTaskProgress(item.progress.photoTaskCount, item.extendedTaskCount)} · Проверено: {item.progress.publishedReviewTaskCount} из {item.extendedTaskCount}</p>}
    </div><span className={styles.workAction}>{action.label}<span aria-hidden="true"> →</span></span>
  </Link></li>;
}

export default function StudentWorksScreen() {
  const query = useQuery({ queryKey: studentWorkQueryKeys.list(), queryFn: studentWorksApi.list, refetchInterval: 10000, refetchIntervalInBackground: false, refetchOnWindowFocus: 'always', refetchOnReconnect: 'always' });
  return <StudentWorksShell><div className={styles.heading}><h1>Работы</h1></div>
    {query.isPending && <p role="status">Загружаем работы…</p>}
    {query.error && <div className={styles.error} role="alert"><p>{apiErrorMessage(query.error)}</p><button className={styles.secondary} onClick={() => void query.refetch()}>Повторить</button></div>}
    {query.data?.length ? <ul className={styles.workList}>{query.data.map((item) => <StudentWorkRow key={item.id} item={item} />)}</ul> : query.data && <p className={styles.empty}>Назначенных работ пока нет.</p>}
  </StudentWorksShell>;
}
