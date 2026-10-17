"use client";
import { useState } from "react";
import { ArrowLeft } from "lucide-react";
import { useCreateStudent } from "./use-teacher-students";
import styles from "./school-classes.module.css";

export default function SingleStudentForm({ onClose }: { onClose: () => void }) {
  const create = useCreateStudent();
  const [error, setError] = useState("");
  return <div className={styles.wizard}>
    <button className={styles.back} disabled={create.isPending} onClick={onClose}><ArrowLeft size={17} aria-hidden="true" />Ученики и доступы</button><h1>Добавить ученика</h1>
    <form onSubmit={async (event) => {
      event.preventDefault(); const form = new FormData(event.currentTarget); setError("");
      try {
        await create.mutateAsync({ login: String(form.get("login")).trim().toLowerCase(), password: String(form.get("password")), firstName: String(form.get("firstName")).trim() || null, lastName: String(form.get("lastName")).trim() || null, middleName: String(form.get("middleName")).trim() || null });
        onClose();
      } catch (reason) { setError(reason instanceof Error ? reason.message : "Не удалось создать ученика."); }
      finally { create.reset(); }
    }}>
      <div className={styles.fields}><label>Фамилия<input name="lastName" autoComplete="off" maxLength={100} /></label><label>Имя<input name="firstName" autoComplete="off" maxLength={100} /></label><label>Отчество<input name="middleName" autoComplete="off" maxLength={100} /></label></div>
      <div className={styles.fields}><label>Логин<input name="login" autoComplete="off" autoCapitalize="none" minLength={3} maxLength={64} pattern="[a-zA-Z0-9._-]+" required /></label><label>Начальный пароль<input name="password" type="password" autoComplete="new-password" minLength={8} maxLength={128} required /></label></div>
      <p className={styles.hint}>Логин латиницей, пароль — от 8 символов. Выбрать класс и доступ к материалам можно в списке учеников.</p>
      {error && <p className={styles.error} role="alert">{error}</p>}
      <div className={styles.footer}><button className={styles.secondary} disabled={create.isPending} type="button" onClick={onClose}>Отмена</button><button className={styles.primary} disabled={create.isPending}>{create.isPending ? "Создаём…" : "Создать ученика"}</button></div>
    </form>
  </div>;
}
