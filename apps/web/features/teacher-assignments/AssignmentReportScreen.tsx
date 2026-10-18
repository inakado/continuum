"use client";
import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import type { AssignmentReport } from '@continuum/shared';
import WorksShell from '@/features/teacher-works/WorksShell';
import WorkSelect from '@/features/teacher-works/WorkSelect';
import { apiErrorMessage } from '@/lib/api/error-message';
import { taskCountLabel } from '@/features/teacher-works/work-labels';
import { pointsLabel } from '@/features/teacher-bank/task-source';
import ui from '@/features/teacher-works/teacher-works.module.css';
import { useAssignmentReport } from './use-assignments';
import styles from './teacher-assignments.module.css';
import StudentSolutionsPanel from './StudentSolutionsPanel';

const statusLabels = { not_started: 'Не начал', in_progress: 'В работе', completed: 'Завершил' };
const filters = [{ id: 'all', label: 'Все' }, { id: 'not_started', label: 'Не начали' }, { id: 'in_progress', label: 'В работе' }, { id: 'completed', label: 'Завершили' }] as const;
export function AssignmentReportView({ data }: { data: AssignmentReport }) {
  const [classId, setClass] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<(typeof filters)[number]['id']>('all');
  const [page, setPage] = useState(1);
  const [viewing, setViewing] = useState<{ id: string; name: string } | null>(null);
  const query = search.trim().toLocaleLowerCase('ru');
  const scoped = data.recipients.filter((item) => (!classId || item.assignmentId === classId) && `${item.name} ${item.login}`.toLocaleLowerCase('ru').includes(query));
  const filtered = scoped.filter((item) => status === 'all' || item.status === status);
  const pages = Math.max(1, Math.ceil(filtered.length / 20));
  const activePage = Math.min(page, pages);
  const shown = filtered.slice((activePage - 1) * 20, activePage * 20);
  return <>
    <Link href="/teacher/works/assignments" className={ui.textButton}><ArrowLeft size={17} />К назначениям</Link>
    <div className={styles.heading}><div><h1>{data.title}</h1><p>Версия {data.versionNumber} · {taskCountLabel(data.taskCount)} · {pointsLabel(data.maxPoints)}</p></div>
      <div className={styles.actions}><Link className={ui.secondary} href={`/teacher/works/${data.workId}/assign?version=${data.versionNumber}&add=1`}>Добавить учеников</Link><Link className={ui.textButton} href={`/teacher/works/${data.workId}/preview?version=${data.versionNumber}`}>Просмотреть работу</Link></div>
    </div>
    <div className={styles.filters}><label>Класс<WorkSelect aria-label="Класс" value={classId} onChange={(event) => { setClass(event.target.value); setPage(1); }}><option value="">Все классы</option>{data.classes.map((item) => <option key={item.id} value={item.id}>{item.title} · {item.academicYear}–{item.academicYear + 1}{item.classId ? '' : ' · удалён'}</option>)}</WorkSelect></label>
      <label>Поиск<input type="search" aria-label="Поиск ученика" placeholder="ФИО или логин" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} /></label>
    </div>
    <div className={styles.statusFilters} aria-label="Состояние выполнения">{filters.map((item) => {
      const count = item.id === 'all' ? scoped.length : scoped.filter((row) => row.status === item.id).length;
      return <button key={item.id} aria-pressed={status === item.id} onClick={() => { setStatus(item.id); setPage(1); }}>{item.label} {count}</button>;
    })}</div>
    {data.extendedTaskCount ? <p className={styles.muted}>Состояние и результат — по тестовой части. Фотографии решений принимаются независимо.</p> : null}
    {shown.length ? <table className={styles.reportTable}><thead><tr><th>Ученик</th><th>Класс</th><th>Состояние</th><th>Заполнено</th><th>Результат</th>{data.extendedTaskCount ? <th>Фото решений</th> : null}</tr></thead><tbody>{shown.map((item) => <tr key={item.id}>
      <td>{item.name}{item.deleted ? <small>Учётная запись удалена</small> : !item.isActive ? <small>Учётная запись отключена</small> : null}</td>
      <td>{data.classes.find((group) => group.id === item.assignmentId)?.title}</td>
      <td className={item.status === 'completed' ? styles.completed : undefined}>{data.automaticTaskCount === 0 ? 'Без тестовой части' : statusLabels[item.status]}</td><td>{item.answeredCount} из {data.automaticTaskCount ?? data.taskCount}</td>
      <td className={item.result ? styles.completed : undefined}>{item.result ? `${item.result.points} из ${item.result.maxPoints} · ${item.result.percentage}%` : '—'}</td>
      {data.extendedTaskCount ? <td><button className={ui.textButton} onClick={() => setViewing({ id: item.id, name: item.name })}>Фото: {item.photoTaskCount ?? 0} из {data.extendedTaskCount}</button></td> : null}
    </tr>)}</tbody></table> : <p className={ui.empty}>По этим фильтрам учеников нет.</p>}
    <div className={styles.pagination}><span>{filtered.length ? `${(activePage - 1) * 20 + 1}–${Math.min(activePage * 20, filtered.length)} из ${filtered.length}` : '0 учеников'}</span><div><button className={ui.secondary} disabled={activePage === 1} onClick={() => setPage(activePage - 1)}>Назад</button><span>{activePage} / {pages}</span><button className={ui.secondary} disabled={activePage === pages} onClick={() => setPage(activePage + 1)}>Далее</button></div></div>
    {viewing && <StudentSolutionsPanel key={viewing.id} id={viewing.id} name={viewing.name} close={() => setViewing(null)} />}
  </>;
}

export default function AssignmentReportScreen({ id }: { id: string }) {
  const query = useAssignmentReport(id);
  return <WorksShell>{query.isPending ? <p role="status">Загружаем выполнение…</p> : null}
    {query.error && <div role="alert" className={ui.error}><p>{apiErrorMessage(query.error)}</p><button className={ui.secondary} onClick={() => void query.refetch()}>Повторить</button></div>}
    {query.data && <AssignmentReportView data={query.data} />}
  </WorksShell>;
}
