"use client";
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import WorksShell from '@/features/teacher-works/WorksShell';
import { apiErrorMessage } from '@/lib/api/error-message';
import ui from '@/features/teacher-works/teacher-works.module.css';
import { useAssignmentPrepare } from './use-assignments';
import AssignmentForm from './AssignmentForm';
import styles from './teacher-assignments.module.css';

export default function WorkAssignmentScreen({ workId, initialVersion, addOnly = false }: { workId: string; initialVersion?: number; addOnly?: boolean }) {
  const [version, setVersion] = useState(initialVersion);
  const [generation, setGeneration] = useState(0);
  const query = useAssignmentPrepare(workId, version);
  const router = useRouter();
  return <WorksShell>
    <Link href={addOnly ? '/teacher/works/assignments' : '/teacher/works'} className={ui.textButton}><ArrowLeft size={17} />{addOnly ? 'К назначениям' : 'К работам'}</Link>
    <div className={styles.heading}><h1>{addOnly ? 'Добавить учеников' : 'Назначить работу'}</h1></div>
    {query.isPending ? <p role="status">Загружаем классы…</p> : query.data ? <AssignmentForm key={`${version ?? 'draft'}-${generation}`} data={query.data} addOnly={addOnly}
      onAssigned={(id) => router.push(`/teacher/works/assignments/${id}`)} onVersionChange={setVersion}
      onReload={() => { void query.refetch().then((result) => { if (!result.error) setGeneration((value) => value + 1); }); }}
      onPreview={() => window.open(`/teacher/works/${workId}/preview${version ? `?version=${version}` : ''}`, '_blank', 'noopener,noreferrer')} /> : null}
    {query.error && <div className={ui.error} role="alert"><p>{apiErrorMessage(query.error)}</p><button className={ui.secondary} onClick={() => void query.refetch()}>Повторить</button></div>}
  </WorksShell>;
}
