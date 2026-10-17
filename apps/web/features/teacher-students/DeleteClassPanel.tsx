"use client";
import { useState } from "react";
import type { SchoolClass } from "@continuum/shared";
import styles from "./school-classes.module.css";

export default function DeleteClassPanel({ schoolClass, busy, onConfirm, onCancel }: {
  schoolClass: SchoolClass; busy: boolean; onConfirm: (deleteStudents: boolean) => void; onCancel: () => void;
}) {
  const [deleteStudents, setDeleteStudents] = useState(false);
  return <section className={styles.deletion} aria-label="Подтверждение удаления класса">
    <h2>Удалить класс «{schoolClass.title}»?</h2>
    <p>По умолчанию ученики останутся без класса. Их учётные записи и доступ к материалам сохранятся.</p>
    <label><input type="checkbox" checked={deleteStudents} disabled={busy} onChange={(event) => setDeleteStudents(event.target.checked)} />Удалить также учётные записи учеников ({schoolClass.studentCount})</label>
    {deleteStudents && <p className={styles.error}>Учётные записи, пароли и доступы учеников этого класса будут удалены без возможности восстановления.</p>}
    <div className={styles.actions}><button className={styles.secondary} disabled={busy} onClick={onCancel}>Отмена</button><button className={styles.danger} disabled={busy} onClick={() => onConfirm(deleteStudents)}>{busy ? "Удаляем…" : deleteStudents ? "Удалить класс и учеников" : "Удалить класс"}</button></div>
  </section>;
}
