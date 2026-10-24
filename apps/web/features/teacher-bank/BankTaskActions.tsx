"use client";

import { useRef, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { MoreHorizontal, Trash2 } from 'lucide-react';
import type { AssessmentTaskView } from '@continuum/shared';
import type { BankDeletion } from './BankDeletionNotice';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/DropdownMenu';
import { apiErrorMessage } from '@/lib/api/error-message';
import { useRemoveBankTask } from './use-teacher-bank';
import styles from './teacher-bank.module.css';

export default function BankTaskActions({ task, query, onDeleted }: { task?: AssessmentTaskView; query: string; onDeleted: (deletion: BankDeletion) => void }) {
  const [menu, setMenu] = useState(false);
  const [snapshot, setSnapshot] = useState<{ id: string; expectedVersion: number; expectedLifecycleRevision: number; title: string; query: string } | null>(null);
  const trigger = useRef<HTMLButtonElement>(null), cancel = useRef<HTMLButtonElement>(null);
  const remove = useRemoveBankTask((receipt) => { if (snapshot) onDeleted({ ...receipt, title: snapshot.title, query: snapshot.query }); setSnapshot(null); });
  const close = () => { if (!remove.isPending) setSnapshot(null); };
  return <>
    <DropdownMenu open={menu} onOpenChange={setMenu}>
      <DropdownMenuTrigger asChild><button ref={trigger} className={styles.taskActionsTrigger} type="button" aria-label="Действия с заданием" disabled={!task?.lifecycleRevision || remove.isPending}><MoreHorizontal size={20} aria-hidden="true" /></button></DropdownMenuTrigger>
      <DropdownMenuContent align="end" className={styles.taskMenu} onCloseAutoFocus={(event) => { if (snapshot) event.preventDefault(); }}>
        <DropdownMenuItem className={styles.deleteItem} onSelect={() => { if (task?.lifecycleRevision) { remove.reset(); setSnapshot({ id: task.id, expectedVersion: task.version, expectedLifecycleRevision: task.lifecycleRevision, title: task.task.title, query }); } }}><Trash2 size={16} aria-hidden="true" />Удалить из банка</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
    <Dialog.Root open={snapshot !== null} onOpenChange={(open) => { if (!open) close(); }}>
      <Dialog.Portal><Dialog.Overlay className={styles.deleteOverlay} /><Dialog.Content className={styles.deleteDialog} onOpenAutoFocus={(event) => { event.preventDefault(); cancel.current?.focus(); }} onCloseAutoFocus={(event) => { event.preventDefault(); trigger.current?.focus(); }}>
        <Dialog.Title>Удалить задание из банка?</Dialog.Title>
        <Dialog.Description>«{snapshot?.title}» исчезнет из банка и выбора заданий. В уже собранных работах оно останется. После удаления появится кнопка «Отменить».</Dialog.Description>
        {remove.error && <p className={styles.error} role="alert">{apiErrorMessage(remove.error)}</p>}
        <div className={styles.deleteButtons}><button ref={cancel} type="button" disabled={remove.isPending} onClick={close}>Отмена</button><button className={styles.deleteConfirm} type="button" disabled={remove.isPending} onClick={() => { if (snapshot) remove.mutate({ id: snapshot.id, expectedVersion: snapshot.expectedVersion, expectedLifecycleRevision: snapshot.expectedLifecycleRevision }); }}>{remove.isPending ? 'Удаляем…' : 'Удалить из банка'}</button></div>
      </Dialog.Content></Dialog.Portal>
    </Dialog.Root>
  </>;
}
