"use client";
import { useRef, useState } from 'react';
import { reviewerPolicy, type ReviewerKeyCreate, type ReviewerTargets } from '@continuum/shared';
import { classLabel } from './reviewer-labels';
import ReviewerStudents from './ReviewerStudents';
import styles from './reviewer-access.module.css';

export default function ReviewerKeyForm({ targets, busy, submit, cancel }: { targets: ReviewerTargets; busy: boolean; submit: (input: ReviewerKeyCreate) => Promise<void>; cancel: () => void }) {
  const [name, setName] = useState('');
  const [classIds, setClassIds] = useState<string[]>([]);
  const [studentIds, setStudentIds] = useState<string[]>([]);
  const password = useRef<HTMLInputElement>(null);
  const toggleClass = (id: string) => setClassIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  const toggleStudent = (id: string) => setStudentIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = password.current?.value ?? '';
    if ((!classIds.length && !studentIds.length) || !name.trim() || !value || busy) return;
    if (password.current) password.current.value = '';
    await submit({ name: name.trim(), password: value, classIds, studentIds });
  }
  return <form className={styles.form} onSubmit={(event) => void save(event)} aria-label="Подключение компьютера">
    <h2>Новый компьютер</h2><p className={styles.muted}>Ключ действует {reviewerPolicy.keyTtlDays} дней. Его можно отозвать в любой момент.</p>
    <label className={styles.field}>Название компьютера<input autoFocus name="computerName" required maxLength={80} placeholder="Например, Mac Александра" value={name} disabled={busy} onChange={(event) => setName(event.target.value)} /></label>
    <fieldset disabled={busy}><legend>Доступ к классам</legend><p className={styles.muted}>Агент сможет проверять работы учеников выбранных классов. Состав обновляется вместе с классом.</p>
      <div className={styles.classChoices}>{targets.classes.map((item) => <label className={styles.check} key={item.id}><input type="checkbox" checked={classIds.includes(item.id)} disabled={classIds.length >= 500 && !classIds.includes(item.id)} onChange={() => toggleClass(item.id)} /><span>{classLabel(item)}</span></label>)}</div>
      {!targets.classes.length && <p className={styles.muted}>Классов пока нет. Можно выбрать отдельных учеников.</p>}
    </fieldset>
    <ReviewerStudents targets={targets} selected={studentIds} toggle={toggleStudent} busy={busy} />
    <label className={styles.field}>Ваш пароль<input ref={password} name="currentPassword" type="password" autoComplete="current-password" required maxLength={128} disabled={busy} /></label>
    <div className={styles.actions}><button className={styles.primary} disabled={busy || classIds.length + studentIds.length === 0} type="submit">{busy ? 'Создаём…' : 'Создать ключ'}</button><button className={styles.secondary} type="button" onClick={cancel}>Отмена</button></div>
  </form>;
}
