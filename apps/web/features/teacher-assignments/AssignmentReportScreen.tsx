"use client";
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
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
import SearchField from '@/components/ui/SearchField';
import AssignedClasses from './AssignedClasses';
import { useReportFilters } from './use-report-filters';
import { useAuthSession } from '@/features/auth/useAuthSession';
import AssignmentProgressRow from './AssignmentProgressRow';
import { matchesPhotoFilter, photoFilters, type PhotoFilter } from './report-photo-filters';
import { TestStatusIcon } from './ReportTestStatus';

const filters = [{ id: 'all', label: 'Все' }, { id: 'not_started', label: 'Не начали' }, { id: 'in_progress', label: 'В работе' }, { id: 'completed', label: 'Завершили' }] as const;
export function AssignmentReportView({ data, onRemovedLast, userId }: { data: AssignmentReport; onRemovedLast?: () => void; userId?: string }) {
  const context = useReportFilters(data.versionId, data.classes, userId);
  const { classId, search, status, photos, page, update } = context;
  const [viewing, setViewing] = useState<{ id: string; name: string } | null>(null);
  const query = search.trim().toLocaleLowerCase('ru');
  const scoped = data.recipients.filter((item) => (!classId || item.assignmentId === classId) && `${item.name} ${item.login}`.toLocaleLowerCase('ru').includes(query));
  const photoScoped = scoped.filter((item) => matchesPhotoFilter(item.progress, data.extendedTaskCount, photos));
  const testScoped = scoped.filter((item) => data.automaticTaskCount === 0 || status === 'all' || item.status === status);
  const filtered = testScoped.filter((item) => matchesPhotoFilter(item.progress, data.extendedTaskCount, photos));
  const pages = Math.max(1, Math.ceil(filtered.length / 20));
  const activePage = Math.min(page, pages);
  const shown = filtered.slice((activePage - 1) * 20, activePage * 20);
  return <>
    <Link href="/teacher/works/assignments" className={ui.textButton}><ArrowLeft size={17} />К назначениям</Link>
    <div className={styles.heading}><div className={styles.reportIdentity}><h1>{data.title}</h1><p>Версия {data.versionNumber} · {taskCountLabel(data.taskCount)} · {pointsLabel(data.maxPoints)}</p>
      <AssignedClasses data={data} onRemoved={(last) => { update({ classId: '', page: 1 }, true); setViewing(null); if (last) onRemovedLast?.(); }} />
    </div>
      <div className={styles.actions}><Link className={ui.secondary} href={`/teacher/works/${data.workId}/assign?version=${data.versionNumber}&add=1`}>Добавить учеников</Link><Link className={ui.textButton} href={`/teacher/statistics/${data.versionId}${classId ? `?class=${classId}` : ''}`}>Статистика</Link><Link className={ui.textButton} href={`/teacher/works/${data.workId}/preview?version=${data.versionNumber}`}>Просмотреть работу</Link></div>
    </div>
    <div className={styles.filters}>{data.classes.length > 1 && <label>Класс<WorkSelect aria-label="Класс" value={classId} onChange={(event) => update({ classId: event.target.value, page: 1 })}><option value="">Все классы</option>{data.classes.map((item) => <option key={item.id} value={item.id}>{item.title} · {item.academicYear}–{item.academicYear + 1}{item.classId ? '' : ' · удалён'}</option>)}</WorkSelect></label>}
      <label>Поиск<SearchField label="Поиск ученика" placeholder="ФИО или логин" maxLength={200} value={search} onValueChange={context.changeSearch} /></label>
      {data.extendedTaskCount > 0 && <label>Развёрнутая часть<WorkSelect aria-label="Развёрнутая часть" value={photos} onChange={(event) => update({ photos: event.target.value as PhotoFilter, page: 1 })}>{photoFilters.map((item) => <option key={item.id} value={item.id}>{item.label} — {testScoped.filter((row) => matchesPhotoFilter(row.progress, data.extendedTaskCount, item.id)).length}</option>)}</WorkSelect></label>}
    </div>
    {data.automaticTaskCount > 0 && <div className={styles.testFilters} role="group" aria-label="Тестовая часть">
      <span className={styles.filterLabel}>Тестовая часть</span>
      <div className={styles.statusOptions}>{filters.map((item) => <button type="button" key={item.id} className={styles.statusFilter} data-status={item.id} aria-pressed={status === item.id} onClick={() => update({ status: item.id, page: 1 })}>
        {item.id !== 'all' && <TestStatusIcon status={item.id} />}{item.label}{' '}<span className={styles.statusCount}>{item.id === 'all' ? photoScoped.length : photoScoped.filter((row) => row.status === item.id).length}</span>
      </button>)}</div>
    </div>}
    {shown.length ? <table className={styles.report}><thead><tr><th scope="col">Ученик</th><th scope="col">Класс</th>{data.automaticTaskCount > 0 && <th scope="col">Тестовая часть</th>}{data.extendedTaskCount > 0 && <><th scope="col">Развёрнутая часть</th><th scope="col">Проверка решений</th></>}</tr></thead><tbody>{shown.map((item) => <AssignmentProgressRow key={item.id} item={item} data={data} onSolutions={() => setViewing({ id: item.id, name: item.name })} />)}</tbody></table> : <p className={ui.empty}>По этим фильтрам учеников нет.</p>}
    <div className={styles.pagination}><span>{filtered.length ? `${(activePage - 1) * 20 + 1}–${Math.min(activePage * 20, filtered.length)} из ${filtered.length}` : '0 учеников'}</span><div><button className={ui.secondary} disabled={activePage === 1} onClick={() => update({ page: activePage - 1 })}>Назад</button><span>{activePage} / {pages}</span><button className={ui.secondary} disabled={activePage === pages} onClick={() => update({ page: activePage + 1 })}>Далее</button></div></div>
    {viewing && <StudentSolutionsPanel key={viewing.id} id={viewing.id} name={viewing.name} close={() => setViewing(null)} />}
  </>;
}

export default function AssignmentReportScreen({ id }: { id: string }) {
  const query = useAssignmentReport(id);
  const session = useAuthSession();
  const router = useRouter();
  return <WorksShell>{query.isPending ? <p role="status">Загружаем выполнение…</p> : null}
    {query.error && <div role="alert" className={ui.error}><p>{apiErrorMessage(query.error)}</p><button className={ui.secondary} onClick={() => void query.refetch()}>Повторить</button></div>}
    {query.data && <AssignmentReportView key={`${session.data?.user.id}:${id}`} data={query.data} userId={session.data?.user.id} onRemovedLast={() => router.replace('/teacher/works/assignments')} />}
  </WorksShell>;
}
