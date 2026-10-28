"use client";
import { useRef, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import type { AssignmentReport } from '@continuum/shared';
import RevokeAssignmentDialog from './RevokeAssignmentDialog';
import { classCountLabel, pupilCount } from './assignment-labels';
import { useAssignedClassesPanel } from './use-assigned-classes-panel';
import styles from './assigned-classes.module.css';

export default function AssignedClasses({ data, onRemoved }: { data: AssignmentReport; onRemoved: (last: boolean) => void }) {
  const [removing, setRemoving] = useState<string | null>(null);
  const confirmationOpening = useRef(false);
  const panel = useAssignedClassesPanel();
  const names = data.classes.map((item) => item.title).join(', ');
  const label = data.classes.length <= 2 && names.length <= 32 && new Set(data.classes.map((item) => item.title)).size === data.classes.length ? names : classCountLabel(data.classes.length);
  const summary = `${label} · ${pupilCount(data.studentCount)}`;
  const recipientCounts = new Map<string, number>();
  for (const recipient of data.recipients) recipientCounts.set(recipient.assignmentId, (recipientCounts.get(recipient.assignmentId) ?? 0) + 1);
  return <div className={styles.summary}>
    <span>Назначено:</span>
    <Dialog.Root modal={false} open={panel.open} onOpenChange={panel.setOpen}>
      <Dialog.Trigger ref={panel.trigger} className={styles.trigger} aria-label={`Управлять назначением: ${summary}`} title="Кому назначена работа"><span>{summary}</span></Dialog.Trigger>
      <Dialog.Portal><Dialog.Content style={panel.position} className={styles.panel} aria-describedby={undefined} onCloseAutoFocus={(event) => {
        if (confirmationOpening.current) { event.preventDefault(); confirmationOpening.current = false; }
      }}>
        <div className={styles.heading}><Dialog.Title>Кому назначена работа</Dialog.Title><Dialog.Close className={styles.close} aria-label="Закрыть назначения"><X size={18} aria-hidden="true" /></Dialog.Close></div>
        <ul className={styles.classes}>{data.classes.map((item) => <li key={item.id}>
          <div className={styles.identity}><strong>{item.title}</strong><small>{item.academicYear}–{item.academicYear + 1} · {pupilCount(recipientCounts.get(item.id) ?? 0)}</small>{!item.classId && <small>Класс удалён</small>}</div>
          <button type="button" className={styles.remove} aria-label={`Удалить назначение у класса ${item.title} за ${item.academicYear}–${item.academicYear + 1}`} onClick={() => { confirmationOpening.current = true; panel.setOpen(false); setRemoving(item.id); }}>Удалить назначение…</button>
        </li>)}</ul>
      </Dialog.Content></Dialog.Portal>
    </Dialog.Root>
    {removing && <RevokeAssignmentDialog id={removing} close={() => setRemoving(null)} onRemoved={() => onRemoved(data.classes.length === 1)} returnFocus={() => panel.trigger.current?.focus()} />}
  </div>;
}
