"use client";
import { useRef } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import type { AssessmentWorkSummary } from '@continuum/shared';
import { apiErrorMessage } from '@/lib/api/error-message';
import { useRemoveTeacherWork } from './use-teacher-works';
import styles from './teacher-works.module.css';

export default function DeleteWorkDialog({ work, onClose, onDeleted, returnFocus }: { work: AssessmentWorkSummary; onClose: () => void; onDeleted: () => void; returnFocus: () => void }) {
  const snapshot = useRef({ id: work.id, title: work.title, expectedRevision: work.revision, expectedLifecycleRevision: work.lifecycleRevision ?? 1 }).current;
  const cancel = useRef<HTMLButtonElement>(null), removed = useRef(false);
  const remove = useRemoveTeacherWork(() => { removed.current = true; onClose(); onDeleted(); });
  const close = () => { if (!remove.isPending) onClose(); };
  return <Dialog.Root open onOpenChange={(open) => { if (!open) close(); }}><Dialog.Portal>
    <Dialog.Overlay className={styles.deleteOverlay} />
    <Dialog.Content className={styles.deleteDialog} onOpenAutoFocus={(event) => { event.preventDefault(); cancel.current?.focus(); }} onCloseAutoFocus={(event) => { event.preventDefault(); if (!removed.current) returnFocus(); }}>
      <Dialog.Title>Удалить черновик?</Dialog.Title>
      <Dialog.Description>«{snapshot.title}» будет удалён. Восстановить черновик не получится. Задания в банке и созданные копии останутся.</Dialog.Description>
      {remove.error && <p role="alert" className={styles.error}>{apiErrorMessage(remove.error, 'Не удалось удалить черновик. Повторите попытку.')}</p>}
      <div className={styles.deleteButtons}><button ref={cancel} type="button" disabled={remove.isPending} onClick={close}>Отмена</button><button className={styles.deleteConfirm} type="button" disabled={remove.isPending} onClick={() => { if (!remove.isPending) remove.mutate({ id: snapshot.id, input: { expectedRevision: snapshot.expectedRevision, expectedLifecycleRevision: snapshot.expectedLifecycleRevision } }); }}>{remove.isPending ? 'Удаляем…' : 'Удалить черновик'}</button></div>
    </Dialog.Content>
  </Dialog.Portal></Dialog.Root>;
}
