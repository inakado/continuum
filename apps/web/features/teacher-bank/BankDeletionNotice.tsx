"use client";

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { X } from 'lucide-react';
import type { AssessmentBankDeletion } from '@continuum/shared';
import { apiErrorMessage } from '@/lib/api/error-message';
import { teacherBankQueryKeys } from '@/lib/query/keys';
import { teacherBankApi } from './teacher-bank.api';
import styles from './teacher-bank.module.css';

export type BankDeletion = AssessmentBankDeletion & { title: string; query: string };

export default function BankDeletionNotice({ deletion, onRestored, onDismiss }: { deletion: BankDeletion; onRestored: () => void; onDismiss: () => void }) {
  const cache = useQueryClient();
  const restore = useMutation({
    mutationFn: () => teacherBankApi.restore(deletion.id, { expectedVersion: deletion.version, expectedDeletionRevision: deletion.deletionRevision }),
    retry: false,
    onSuccess: async () => { await cache.invalidateQueries({ queryKey: teacherBankQueryKeys.all() }); onRestored(); },
  });
  return <section className={styles.deletionNotice} aria-label={`Удалено: ${deletion.title}`}>
    <div className={styles.deletionMessage}><p role="status">«{deletion.title}» — задание удалено</p>{restore.error && <p className={styles.error} role="alert">{apiErrorMessage(restore.error)}</p>}</div>
    <button type="button" className={styles.textButton} disabled={restore.isPending} onClick={() => restore.mutate()}>{restore.isPending ? 'Возвращаем…' : 'Отменить'}</button>
    <button type="button" className={styles.dismissNotice} disabled={restore.isPending} onClick={onDismiss} aria-label={`Закрыть уведомление об удалении: ${deletion.title}`}><X size={18} aria-hidden="true" /></button>
  </section>;
}
