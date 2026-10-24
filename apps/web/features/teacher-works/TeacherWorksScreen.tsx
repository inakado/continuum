"use client";
import { useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Plus } from 'lucide-react';
import { pointsLabel } from '@/features/teacher-bank/task-source';
import { useCreateTeacherWork, useTeacherWorks } from './use-teacher-works';
import WorksShell from './WorksShell';
import WorkActions from './WorkActions';
import WorkSelect from './WorkSelect';
import { taskCountLabel, workGrades, workStateLabel } from './work-labels';
import { apiErrorMessage } from '@/lib/api/error-message';
import WorkTabs from '@/features/teacher-assignments/WorkTabs';
import styles from './teacher-works.module.css';
import SearchField from '@/components/ui/SearchField';
import { useWorksFilters } from './use-works-filters';

function EmptyWorks({ search, archived }: { search: string; archived: boolean }) {
  return <div className={styles.empty}><h2>{search ? 'Ничего не найдено' : archived ? 'Архив пуст' : 'Пока нет работ'}</h2><p>{search ? 'Измените название в поиске.' : archived ? 'Здесь появятся работы, которые вы отправите в архив.' : 'Создайте работу и выберите задания из банка.'}</p></div>;
}
export default function TeacherWorksScreen() {
  const query = useTeacherWorks();
  const create = useCreateTeacherWork();
  const router = useRouter();
  const request = useRef<string | null>(null);
  const { search, archived, update, listQuery } = useWorksFilters();
  const searchInput = useRef<HTMLInputElement>(null);
  async function newWork() {
    request.current ??= crypto.randomUUID();
    const work = await create.mutateAsync({ id: request.current, title: 'Новая работа', gradeBand: 'grade_10_11' }).catch(() => null);
    if (work) router.push(`/teacher/works/${work.id}`);
  }
  const works = query.data?.filter((work) => Boolean(work.isArchived) === archived && work.title.toLocaleLowerCase('ru').includes(search.toLocaleLowerCase('ru'))) ?? [];
  return <WorksShell><div className={styles.heading}><div><h1>Работы</h1><p>Состав и порядок заданий из вашего банка</p></div><button className={styles.primary} disabled={create.isPending} onClick={() => void newWork()}><Plus size={18} />{create.isPending ? 'Создаём…' : create.error ? 'Повторить создание' : 'Создать работу'}</button></div>
    <WorkTabs active="works" />
    {create.error && <p role="alert" className={styles.error}>{apiErrorMessage(create.error, 'Не удалось создать работу. Повторите попытку.')}</p>}
    <div className={styles.listFilters}><label className={styles.search}>Поиск<SearchField inputRef={searchInput} placeholder="Название работы" label="Поиск работ" maxLength={200} value={search} onValueChange={(search) => update({ search }, true)} /></label><label className={styles.stateFilter}>Показывать<WorkSelect value={archived ? 'archived' : 'active'} onChange={(event) => update({ archived: event.target.value === 'archived' })}><option value="active">Текущие работы</option><option value="archived">Архив</option></WorkSelect></label></div>
    {query.isPending ? <p role="status">Загружаем работы…</p> : query.error ? <div role="alert"><p>{apiErrorMessage(query.error)}</p><button className={styles.secondary} onClick={() => void query.refetch()}>Повторить</button></div> : works.length ? <ul className={styles.works}>{works.map((work) => <li key={work.id} className={styles.workListRow}><Link href={`/teacher/works/${work.id}${listQuery ? `?${listQuery}` : ''}`}><div><strong>{work.title}</strong><span>{workGrades[work.gradeBand]} · {workStateLabel(work.isArchived)}</span></div><span>{taskCountLabel(work.taskCount)} · {pointsLabel(work.maxPoints)}</span></Link>{work.taskCount > 0 && <Link className={styles.textButton} href={`/teacher/works/${work.id}/assign`}>Назначить</Link>}<WorkActions work={work} onHidden={() => searchInput.current?.focus()} /></li>)}</ul> : <EmptyWorks search={search} archived={archived} />}
  </WorksShell>;
}
