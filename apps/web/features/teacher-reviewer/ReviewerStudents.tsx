"use client";
import { useState } from 'react';
import { ChevronDown, X } from 'lucide-react';
import type { ReviewerTargets } from '@continuum/shared';
import { classLabel } from './reviewer-labels';
import styles from './reviewer-access.module.css';
import SearchField from '@/components/ui/SearchField';

export default function ReviewerStudents({ targets, selected, toggle, busy }: { targets: ReviewerTargets; selected: string[]; toggle: (id: string) => void; busy: boolean }) {
  const [search, setSearch] = useState('');
  const [classId, setClassId] = useState('all');
  const needle = search.trim().toLocaleLowerCase('ru-RU');
  const matches = targets.students.filter((student) =>
    (classId === 'all' || (classId === 'none' ? !student.classId : student.classId === classId)) &&
    `${student.name} ${student.login}`.toLocaleLowerCase('ru-RU').includes(needle));
  return <details className={styles.pupilDetails}>
    <summary>Отдельные ученики{selected.length > 0 && ` · ${selected.length}`}</summary>
    <p className={styles.muted}>Доступ к выбранному ученику сохранится при переводе в другой класс.</p>
    {selected.length > 0 && <ul className={styles.selectedStudents} aria-label="Выбранные ученики">{selected.map((id) => {
      const student = targets.students.find((item) => item.id === id);
      return <li key={id}><span>{student?.name ?? 'Недоступный ученик'}</span><button type="button" disabled={busy} className={styles.remove} aria-label={`Убрать ${student?.name ?? 'ученика'}`} onClick={() => toggle(id)}><X aria-hidden="true" size={16} /></button></li>;
    })}</ul>}
    <div className={styles.filters}>
      <label className={styles.field}>Поиск ученика<SearchField label="Поиск ученика" placeholder="ФИО или логин" value={search} onValueChange={setSearch} disabled={busy} /></label>
      <label className={styles.field}>Класс ученика<span className={styles.selectWrap}><select value={classId} onChange={(event) => setClassId(event.target.value)} disabled={busy}><option value="all">Все ученики</option><option value="none">Без класса</option>{targets.classes.map((item) => <option key={item.id} value={item.id}>{classLabel(item)}</option>)}</select><ChevronDown aria-hidden="true" size={18} /></span></label>
    </div>
    <div className={styles.choices}>{matches.map((student) => <label className={styles.check} key={student.id}><input type="checkbox" checked={selected.includes(student.id)} disabled={busy || (selected.length >= 500 && !selected.includes(student.id))} onChange={() => toggle(student.id)} /><span>{student.name}<small>{student.login} · {targets.classes.find((item) => item.id === student.classId)?.title ?? 'Без класса'}</small></span></label>)}</div>
    {!matches.length && <p className={styles.muted}>Ученики не найдены. Измените поиск или класс.</p>}
  </details>;
}
