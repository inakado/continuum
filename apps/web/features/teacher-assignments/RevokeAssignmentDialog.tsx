"use client";
import { useEffect, useRef, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import type { AssignmentRevocationPreview } from '@continuum/shared';
import { apiErrorMessage } from '@/lib/api/error-message';
import { useRevocationPreview, useRevokeAssignment } from './use-assignments';
import ui from '@/features/teacher-works/teacher-works.module.css';

export default function RevokeAssignmentDialog({ id, close, onRemoved, returnFocus }: { id: string; close: () => void; onRemoved: () => void; returnFocus: (removed: boolean) => void }) {
  const preview = useRevocationPreview(id);
  const [data, setData] = useState<AssignmentRevocationPreview | null>(null);
  useEffect(() => { if (!data && preview.data) setData(preview.data); }, [data, preview.data]);
  const removed = useRef(false), cancel = useRef<HTMLButtonElement>(null);
  const busy = useRef(false);
  const mutation = useRevokeAssignment(() => { removed.current = true; close(); onRemoved(); });
  const dismiss = () => { if (!busy.current) close(); };
  function revoke() {
    if (!data || busy.current) return;
    busy.current = true;
    mutation.mutate({ id, input: { expectedRecipientsHash: data.recipientsHash } }, { onSettled: () => { busy.current = false; } });
  }
  return <Dialog.Root open onOpenChange={(open) => { if (!open) dismiss(); }}><Dialog.Portal>
    <Dialog.Overlay className={ui.deleteOverlay} />
    <Dialog.Content className={ui.deleteDialog} onOpenAutoFocus={(event) => { event.preventDefault(); cancel.current?.focus(); }} onCloseAutoFocus={(event) => { event.preventDefault(); returnFocus(removed.current); }}>
      <Dialog.Title>Удалить назначение?</Dialog.Title>
      <Dialog.Description>{data ? <>Работа «{data.title}» исчезнет у получателей назначения класса {data.classTitle} · {data.academicYear}–{data.academicYear + 1}. Все их ответы, фотографии, проверки и результаты этой работы будут удалены. Восстановить их нельзя. Другие классы не затронуты.</> : 'Проверяем назначение перед удалением.'}</Dialog.Description>
      {data && <p>Учеников: {data.studentCount} · Начали: {data.startedCount} · Завершили: {data.completedCount}</p>}
      {!data && preview.isPending && <p role="status">Загружаем получателей…</p>}
      {!data && preview.error && <div role="alert" className={ui.error}><p>{apiErrorMessage(preview.error)}</p><button type="button" className={ui.textButton} onClick={() => void preview.refetch()}>Повторить</button></div>}
      {mutation.error && <p role="alert" className={ui.error}>{apiErrorMessage(mutation.error, 'Не удалось подтвердить отзыв. Повторите попытку.')}</p>}
      <div className={ui.deleteButtons}><button ref={cancel} type="button" disabled={mutation.isPending} onClick={dismiss}>Отмена</button><button type="button" className={ui.deleteConfirm} disabled={!data || mutation.isPending} onClick={revoke}>{mutation.isPending ? 'Удаляем…' : 'Удалить назначение'}</button></div>
    </Dialog.Content>
  </Dialog.Portal></Dialog.Root>;
}
