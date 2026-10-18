"use client";
import { useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Trash2 } from 'lucide-react';
import * as Dialog from '@radix-ui/react-dialog';
import { apiErrorMessage } from '@/lib/api/error-message';
import { teacherLibraryQueryKeys } from '@/lib/query/keys';
import { teacherLibraryApi, type LibraryDeletion } from './teacher-library.api';
import styles from './library-delete.module.css';

const nouns = { section: 'раздел', lesson: 'занятие', pdf: 'конспект PDF', tasks_pdf: 'задачи PDF' };

export default function LibraryDeleteAction({ target, title, icon = false, disabled = false }: { target: LibraryDeletion; title: string; icon?: boolean; disabled?: boolean }) {
  const [snapshot, setSnapshot] = useState<(LibraryDeletion & { title: string }) | null>(null);
  const cancel = useRef<HTMLButtonElement>(null);
  const client = useQueryClient();
  const mutation = useMutation({ mutationFn: teacherLibraryApi.delete, onSuccess: async () => {
    await client.invalidateQueries({ queryKey: teacherLibraryQueryKeys.all() });
    setSnapshot(null);
  }, onError: () => { void client.invalidateQueries({ queryKey: teacherLibraryQueryKeys.all() }); } });
  const noun = nouns[snapshot?.kind ?? target.kind];
  const close = () => { if (!mutation.isPending) setSnapshot(null); };
  const name = snapshot?.title ?? title;
  const description = target.kind === 'section'
    ? `«${name}» и все его занятия с файлами будут удалены. Восстановить их нельзя.`
    : target.kind === 'lesson' ? `«${name}» и все его файлы будут удалены. Восстановить их нельзя.`
      : `Все версии файла «${name}» будут удалены. Занятие и остальные материалы сохранятся.`;
  return <Dialog.Root open={snapshot !== null} onOpenChange={(open) => { if (open) { mutation.reset(); setSnapshot({ ...target, title, expectedIds: [...target.expectedIds] }); } else close(); }}>
    <Dialog.Trigger asChild><button data-library-delete type="button" className={icon ? styles.icon : styles.link} disabled={disabled || mutation.isPending} aria-label={`Удалить ${noun} «${title}»`}>
      {icon ? <Trash2 aria-hidden="true" size={16} /> : target.kind === 'lesson' ? 'Удалить занятие' : 'Удалить'}
    </button></Dialog.Trigger>
    <Dialog.Portal><Dialog.Overlay className={styles.overlay} /><Dialog.Content className={styles.dialog} onOpenAutoFocus={(event) => { event.preventDefault(); cancel.current?.focus(); }}>
      <Dialog.Title>Удалить {noun}?</Dialog.Title>
      <Dialog.Description>{description}</Dialog.Description>
      {mutation.error && <p className={styles.error} role="alert">{apiErrorMessage(mutation.error)}</p>}
      <div className={styles.actions}>
        <button ref={cancel} autoFocus type="button" disabled={mutation.isPending} onClick={close}>Отмена</button>
        <button type="button" className={styles.confirm} disabled={mutation.isPending} onClick={() => { if (snapshot) mutation.mutate({ kind: snapshot.kind, id: snapshot.id, expectedIds: snapshot.expectedIds }); }}>{mutation.isPending ? 'Удаляем…' : `Удалить ${noun}`}</button>
      </div>
    </Dialog.Content></Dialog.Portal>
  </Dialog.Root>;
}
