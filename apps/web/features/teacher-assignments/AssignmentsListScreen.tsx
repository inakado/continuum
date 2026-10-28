"use client";
import { useState } from 'react';
import Link from 'next/link';
import WorksShell from '@/features/teacher-works/WorksShell';
import { apiErrorMessage } from '@/lib/api/error-message';
import ui from '@/features/teacher-works/teacher-works.module.css';
import { useAssignments } from './use-assignments';
import WorkTabs from './WorkTabs';
import styles from './teacher-assignments.module.css';
import SearchField from '@/components/ui/SearchField';

export default function AssignmentsListScreen() {
  const query = useAssignments();
  const [search, setSearch] = useState('');
  const rows = query.data?.filter((item) => `${item.title} ${item.classes.map((group) => group.title).join(' ')}`.toLocaleLowerCase('ru').includes(search.toLocaleLowerCase('ru'))) ?? [];
  return <WorksShell><div className={styles.heading}><h1>Работы</h1></div><WorkTabs active="assignments" />
    <label className={ui.search}>Поиск<SearchField label="Поиск назначений" placeholder="Работа или класс" value={search} onValueChange={setSearch} /></label>
    {query.isPending && <p role="status">Загружаем назначения…</p>}
    {query.error && <div role="alert" className={ui.error}><p>{apiErrorMessage(query.error)}</p><button className={ui.secondary} onClick={() => void query.refetch()}>Повторить</button></div>}
    {rows.length ? <ul className={styles.assignmentList}>{rows.map((item) => <li key={item.versionId}><Link href={`/teacher/works/assignments/${item.versionId}`}>
      <div className={styles.assignmentIdentity}><strong>{item.title}</strong><p>Версия {item.versionNumber} · {item.classes.map((group) => group.title).join(', ')}</p></div><div className={styles.assignmentProgress}>
        {item.automaticTaskCount > 0 && <span>Тест завершили: {item.completedCount} из {item.studentCount}</span>}
        {item.extendedTaskCount > 0 && <><span>Все решения: {item.allPhotosCount} из {item.studentCount} учеников</span><span>Решения проверены: {item.allReviewsPublishedCount} из {item.studentCount} учеников</span></>}
      </div>
    </Link></li>)}</ul> : query.data && <div className={ui.empty}><h2>{search ? 'Ничего не найдено' : 'Пока нет назначений'}</h2>{!search && <p>Выберите работу во вкладке «Мои работы» и назначьте её классам.</p>}</div>}
  </WorksShell>;
}
