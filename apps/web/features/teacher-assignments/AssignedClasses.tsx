"use client";
import { useRef, useState } from 'react';
import type { AssignmentReport } from '@continuum/shared';
import RevokeAssignmentDialog from './RevokeAssignmentDialog';
import styles from './teacher-assignments.module.css';

export default function AssignedClasses({ data, onRemoved }: { data: AssignmentReport; onRemoved: (last: boolean) => void }) {
  const [removing, setRemoving] = useState<string | null>(null);
  const trigger = useRef<HTMLButtonElement | null>(null), summary = useRef<HTMLElement>(null);
  return <details className={styles.assignedClasses}>
    <summary ref={summary}>Назначенные классы: {data.classes.length}</summary>
    <ul>{data.classes.map((item) => <li key={item.id}><span>{item.title} <small>{item.academicYear}–{item.academicYear + 1}</small></span><button type="button" className={styles.revokeButton} aria-label={`Убрать назначение у класса ${item.title}`} onClick={(event) => { trigger.current = event.currentTarget; setRemoving(item.id); }}>Убрать назначение</button></li>)}</ul>
    {removing && <RevokeAssignmentDialog id={removing} close={() => setRemoving(null)} onRemoved={() => onRemoved(data.classes.length === 1)} returnFocus={(removed) => { if (removed) summary.current?.focus(); else trigger.current?.focus(); }} />}
  </details>;
}
