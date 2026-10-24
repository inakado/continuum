"use client";

import { useRef, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import type { TeacherStudent } from '@continuum/shared';
import { apiErrorMessage } from '@/lib/api/error-message';
import { useUpdateStudentNames } from './use-teacher-students';
import styles from './student-names.module.css';

export default function StudentNamesForm({ student, onClose, returnFocus }: { student: TeacherStudent; onClose: () => void; returnFocus?: () => void }) {
  const [firstName, setFirstName] = useState(student.firstName ?? '');
  const [lastName, setLastName] = useState(student.lastName ?? '');
  const [middleName, setMiddleName] = useState(student.middleName ?? '');
  const expected = useRef({ firstName: student.firstName, lastName: student.lastName, middleName: student.middleName });
  const firstField = useRef<HTMLInputElement>(null);
  const save = useUpdateStudentNames();
  const close = () => { if (!save.isPending) onClose(); };
  return <Dialog.Root open onOpenChange={(open) => { if (!open) close(); }}><Dialog.Portal>
    <Dialog.Overlay className={styles.overlay} />
    <Dialog.Content className={styles.dialog} onOpenAutoFocus={(event) => { event.preventDefault(); firstField.current?.focus(); }} onCloseAutoFocus={(event) => { if (returnFocus) { event.preventDefault(); returnFocus(); } }}>
      <Dialog.Title>Изменить данные ученика</Dialog.Title>
      <Dialog.Description>Логин: {student.login}</Dialog.Description>
      <form onSubmit={(event) => {
        event.preventDefault();
        if (save.isPending) return;
        save.mutate({ studentId: student.id, input: { firstName: firstName.trim(), lastName: lastName.trim(), middleName: middleName.trim() || null,
          expected: expected.current } }, { onSuccess: onClose });
      }}>
        <fieldset disabled={save.isPending} className={styles.fields}>
          <label>Фамилия<input ref={firstField} name="lastName" value={lastName} onChange={(event) => setLastName(event.target.value)} required maxLength={100} autoComplete="off" /></label>
          <label>Имя<input name="firstName" value={firstName} onChange={(event) => setFirstName(event.target.value)} required maxLength={100} autoComplete="off" /></label>
          <label>Отчество<input name="middleName" value={middleName} onChange={(event) => setMiddleName(event.target.value)} maxLength={100} autoComplete="off" /></label>
        </fieldset>
        {save.error && <p className={styles.error} role="alert">{apiErrorMessage(save.error, 'Не удалось сохранить данные ученика. Повторите попытку.')}</p>}
        <div className={styles.actions}><button type="button" disabled={save.isPending} onClick={close}>Отмена</button><button type="submit" className={styles.primary} disabled={save.isPending || !firstName.trim() || !lastName.trim()}>{save.isPending ? 'Сохраняем…' : 'Сохранить'}</button></div>
      </form>
    </Dialog.Content>
  </Dialog.Portal></Dialog.Root>;
}
