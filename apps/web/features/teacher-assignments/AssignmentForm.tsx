"use client";
import { useRef, useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import type { AssignmentCreate, AssignmentPrepare } from '@continuum/shared';
import { ApiError } from '@/lib/api/client';
import WorkSelect from '@/features/teacher-works/WorkSelect';
import { workGrades, taskCountLabel } from '@/features/teacher-works/work-labels';
import { pointsLabel } from '@/features/teacher-bank/task-source';
import { apiErrorMessage } from '@/lib/api/error-message';
import ui from '@/features/teacher-works/teacher-works.module.css';
import { useAssignWork } from './use-assignments';
import styles from './teacher-assignments.module.css';

const pupilCount = (value: number) => `${value} ${value % 100 >= 11 && value % 100 <= 14 ? 'учеников' : value % 10 === 1 ? 'ученик' : value % 10 >= 2 && value % 10 <= 4 ? 'ученика' : 'учеников'}`;
const classCountLabel = (value: number) => `${value} ${value % 100 >= 11 && value % 100 <= 14 ? 'классов' : value % 10 === 1 ? 'класс' : value % 10 >= 2 && value % 10 <= 4 ? 'класса' : 'классов'}`;
const eligible = (item: AssignmentPrepare['classes'][number]) => item.students.filter((student) => student.isActive && !student.alreadyAssigned);
type Props = { data: AssignmentPrepare; addOnly?: boolean; onAssigned: (versionId: string) => void; onReload: () => void; onVersionChange: (number?: number) => void; onPreview: () => void };

export default function AssignmentForm({ data, addOnly = false, onAssigned, onReload, onVersionChange, onPreview }: Props) {
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [opened, setOpened] = useState<string | null>(null);
  const pending = useRef<AssignmentCreate | null>(null);
  const mutation = useAssignWork(data.work.id);
  const locked = mutation.isPending || pending.current !== null;
  const classes = data.classes.filter((item) => !addOnly || item.assignmentId);
  const available = classes.filter((item) => eligible(item).length > 0 && (addOnly || !item.assignmentId));
  const recipients = new Set(available.filter((item) => selected.has(item.id)).flatMap((item) => eligible(item).map((student) => student.id)));
  const classCount = selected.size;
  const definiteError = mutation.error instanceof ApiError && mutation.error.status < 500;
  function toggle(id: string) {
    setSelected((previous) => { const next = new Set(previous); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  }
  async function assign() {
    pending.current ??= { requestId: crypto.randomUUID(), selection: data.selection, classes: available.filter((item) => selected.has(item.id)).map((item) => ({ id: item.id, rosterHash: item.rosterHash })) };
    const result = await mutation.mutateAsync(pending.current).catch(() => null);
    if (result) onAssigned(result.versionId);
  }
  return <>
    <div className={styles.workInfo}>
      <div><h2>{data.work.title}</h2><p>{workGrades[data.work.gradeBand]} · {taskCountLabel(data.work.taskCount)} · {pointsLabel(data.work.maxPoints)}</p></div>
      <div className={styles.workActions}><label>Редакция<WorkSelect aria-label="Редакция" disabled={locked || addOnly} value={data.selection.kind === 'draft' ? '' : data.selection.number} onChange={(event) => onVersionChange(event.target.value ? Number(event.target.value) : undefined)}>
        <option value="">Текущая сохранённая</option>{data.versions.map((item) => <option value={item.number} key={item.number}>Версия {item.number} · {taskCountLabel(item.taskCount)}</option>)}
      </WorkSelect></label><button className={ui.textButton} onClick={onPreview}>Просмотреть работу</button></div>
    </div>
    <h2 className={styles.sectionTitle}>Классы</h2>
    {!classes.length ? <p className={ui.empty}>{addOnly ? 'Нет классов с назначенной версией.' : 'Текущих классов пока нет. Создайте класс в разделе «Ученики и доступы».'}</p> : <table className={styles.classTable}>
      <thead><tr><th><input type="checkbox" aria-label="Выбрать все доступные классы" disabled={locked || !available.length} checked={available.length > 0 && selected.size === available.length} ref={(node) => { if (node) node.indeterminate = selected.size > 0 && selected.size < available.length; }} onChange={() => setSelected(selected.size === available.length ? new Set() : new Set(available.map((item) => item.id)))} /></th><th>Класс</th><th>Учебный год</th><th>Ученики</th><th><span className={ui.srOnly}>Состав класса</span></th></tr></thead>
      <tbody>{classes.map((item) => {
        const canChoose = available.some((choice) => choice.id === item.id);
        const count = eligible(item).length;
        return <ClassRow key={item.id} item={item} selected={selected.has(item.id)} disabled={locked || !canChoose} count={count} already={Boolean(item.assignmentId) && !addOnly} open={opened === item.id} onToggle={() => toggle(item.id)} onOpen={() => setOpened(opened === item.id ? null : item.id)} />;
      })}</tbody>
    </table>}
    <div className={styles.confirmBar}><span>Выбрано: {classCountLabel(classCount)} · {pupilCount(recipients.size)}</span>
      <button className={ui.primary} disabled={mutation.isPending || !recipients.size || !data.work.taskCount || definiteError} onClick={() => void assign()}>{mutation.isPending ? 'Назначаем…' : mutation.error ? 'Повторить назначение' : addOnly ? 'Добавить учеников' : 'Назначить'}</button>
    </div>
    <p className={styles.muted}>Работа появится у учеников сразу. Без срока выполнения.</p>
    {mutation.error && <div className={ui.error} role="alert"><p>{apiErrorMessage(mutation.error, 'Не удалось получить подтверждение. Повторите назначение — дубликатов не будет.')}</p>{definiteError && <button className={ui.secondary} onClick={onReload}>Проверить получателей заново</button>}</div>}
  </>;
}

function ClassRow({ item, selected, disabled, count, already, open, onToggle, onOpen }: { item: AssignmentPrepare['classes'][number]; selected: boolean; disabled: boolean; count: number; already: boolean; open: boolean; onToggle: () => void; onOpen: () => void }) {
  return <><tr className={selected ? styles.selected : undefined}>
    <td><input type="checkbox" aria-label={`Выбрать ${item.title}`} disabled={disabled} checked={selected} onChange={onToggle} /></td>
    <td>{item.title}</td><td>{item.academicYear}–{item.academicYear + 1}</td><td>{already ? 'Уже назначено' : !item.students.length ? 'Нет учеников' : count ? pupilCount(count) : 'Нет новых активных учеников'}</td>
    <td>{item.students.length > 0 && <button className={ui.textButton} aria-expanded={open} onClick={onOpen}>Список учеников{open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}</button>}</td>
  </tr>{open && <tr><td colSpan={5}><ul className={styles.roster}>{item.students.map((student) => <li key={student.id}>{student.name}<span>{!student.isActive ? 'Отключён' : student.alreadyAssigned ? 'Уже назначено' : student.login}</span></li>)}</ul></td></tr>}</>;
}
