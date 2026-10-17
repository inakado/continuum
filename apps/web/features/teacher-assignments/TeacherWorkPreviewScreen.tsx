"use client";
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { teacherWorkQueryKeys } from '@/lib/query/keys';
import WorksShell from '@/features/teacher-works/WorksShell';
import WorkPreview from '@/features/teacher-works/WorkPreview';
import { teacherWorksApi } from '@/features/teacher-works/teacher-works.api';
import { apiErrorMessage } from '@/lib/api/error-message';
import ui from '@/features/teacher-works/teacher-works.module.css';
import styles from './teacher-assignments.module.css';

export default function TeacherWorkPreviewScreen({ workId, version }: { workId: string; version?: number }) {
  const query = useQuery({ queryKey: teacherWorkQueryKeys.preview(workId, version), queryFn: async () => version ? await teacherWorksApi.version(workId, version) : await teacherWorksApi.detail(workId) });
  return <WorksShell><Link className={ui.textButton} href={`/teacher/works/${workId}/assign${version ? `?version=${version}` : ''}`}>К назначению</Link>
    {query.isPending && <p role="status">Загружаем работу…</p>}
    {query.error && <div role="alert"><p>{apiErrorMessage(query.error)}</p><button className={ui.secondary} onClick={() => void query.refetch()}>Повторить</button></div>}
    {query.data && <><div className={styles.heading}><h1>{query.data.title}</h1><p>{version ? `Версия ${version}` : 'Текущая сохранённая редакция'}</p></div>
      {query.data.instructions && <p className={ui.instructions}>{query.data.instructions}</p>}
      <WorkPreview id={workId} revision={query.data.revision} items={query.data.items} dirty={false} readOnly />
    </>}
  </WorksShell>;
}
