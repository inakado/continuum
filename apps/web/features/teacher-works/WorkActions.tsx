"use client";
import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { MoreHorizontal } from 'lucide-react';
import type { AssessmentWorkArchive, AssessmentWorkCopy, AssessmentWorkSummary } from '@continuum/shared';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/DropdownMenu';
import { ApiError } from '@/lib/api/client';
import { apiErrorMessage } from '@/lib/api/error-message';
import { useArchiveTeacherWork, useCopyTeacherWork } from './use-teacher-works';
import DeleteWorkDialog from './DeleteWorkDialog';
import styles from './teacher-works.module.css';

export default function WorkActions({ work, onHidden }: { work: AssessmentWorkSummary; onHidden: () => void }) {
  const copy = useCopyTeacherWork();
  const archive = useArchiveTeacherWork(onHidden);
  const [deleting, setDeleting] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const archiveRequest = useRef<AssessmentWorkArchive | null>(null);
  const archiveFocus = useRef(false);
  const router = useRouter();
  const request = useRef<AssessmentWorkCopy | null>(null);
  const busy = useRef(false);
  async function createCopy() {
    if (busy.current) return;
    busy.current = true;
    archive.reset();
    request.current ??= { id: crypto.randomUUID(), expectedRevision: work.revision };
    try {
      const result = await copy.mutateAsync({ sourceId: work.id, input: request.current });
      router.push(`/teacher/works/${result.id}`);
    } catch (error) {
      if (error instanceof ApiError && error.status >= 400 && error.status < 500 && error.status !== 408) request.current = null;
    } finally { busy.current = false; }
  }
  async function toggleArchive() {
    if (busy.current) return;
    busy.current = true;
    copy.reset();
    archiveRequest.current ??= { isArchived: !work.isArchived, expectedLifecycleRevision: work.lifecycleRevision ?? 1 };
    try { await archive.mutateAsync({ id: work.id, input: archiveRequest.current }); }
    catch (error) { if (error instanceof ApiError && error.status >= 400 && error.status < 500 && error.status !== 408) archiveRequest.current = null; }
    finally { busy.current = false; }
  }
  const pending = copy.isPending || archive.isPending;
  return <>
    <DropdownMenu modal={false}><DropdownMenuTrigger asChild><button ref={trigger} className={styles.iconButton} type="button" disabled={pending} aria-busy={pending} aria-label={`Действия с работой: ${work.title}`}><MoreHorizontal size={19} aria-hidden="true" /></button></DropdownMenuTrigger>
      <DropdownMenuContent align="end" className={styles.menu} onCloseAutoFocus={(event) => { if (deleting) event.preventDefault(); if (archiveFocus.current) { event.preventDefault(); archiveFocus.current = false; onHidden(); } }}>
        <DropdownMenuItem disabled={pending} onSelect={() => { void createCopy(); }}>Создать копию</DropdownMenuItem>
        <DropdownMenuItem disabled={pending} onSelect={() => { archiveFocus.current = true; void toggleArchive(); }}>{work.isArchived ? 'Восстановить' : 'В архив'}</DropdownMenuItem>
        {work.canDelete && <><div role="separator" className={styles.menuRule} /><DropdownMenuItem disabled={pending} className={styles.dangerItem} onSelect={() => { copy.reset(); archive.reset(); setDeleting(true); }}>Удалить черновик</DropdownMenuItem></>}
      </DropdownMenuContent>
    </DropdownMenu>
    {copy.isPending && <p role="status" className={styles.copyFeedback}>Создаём копию…</p>}
    {archive.isPending && <p role="status" className={styles.copyFeedback}>Сохраняем…</p>}
    {copy.error && <div role="alert" className={`${styles.copyFeedback} ${styles.error}`}><p>{apiErrorMessage(copy.error, 'Не удалось создать копию. Повторите попытку.')}</p><button type="button" className={styles.textButton} onClick={() => { void createCopy(); }}>Повторить копирование</button></div>}
    {archive.error && <div role="alert" className={`${styles.copyFeedback} ${styles.error}`}><p>{apiErrorMessage(archive.error, 'Не удалось изменить состояние работы. Повторите попытку.')}</p><button type="button" className={styles.textButton} onClick={() => { void toggleArchive(); }}>Повторить</button></div>}
    {deleting && <DeleteWorkDialog work={work} onClose={() => setDeleting(false)} onDeleted={onHidden} returnFocus={() => trigger.current?.focus()} />}
  </>;
}
