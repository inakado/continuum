"use client";

import type { FormEvent } from "react";
import { useState } from "react";
import type { GradeBand, TeacherStudent } from "@continuum/shared";
import Link from "next/link";
import ContinuumHeader from "@/components/ContinuumHeader";
import { ApiError } from "@/lib/api/client";
import {
  useCreateStudent,
  useSetStudentAccess,
  useSetStudentActive,
  useTeacherStudents,
} from "./use-teacher-students";
import styles from "./teacher-students.module.css";

const grades: Array<{ code: GradeBand; short: string; label: string }> = [
  { code: "grade_7", short: "7", label: "7 класс" },
  { code: "grade_8", short: "8", label: "8 класс" },
  { code: "grade_9", short: "9", label: "9 класс" },
  { code: "grade_10_11", short: "10–11", label: "10–11 класс" },
];

type StudentRowsProps = {
  students: TeacherStudent[];
  busy: boolean;
  onSetActive: (student: TeacherStudent) => void;
  onSetAccess: (student: TeacherStudent, gradeBand: GradeBand, enabled: boolean) => void;
};

export function StudentRows({ students, busy, onSetActive, onSetAccess }: StudentRowsProps) {
  if (students.length === 0) {
    return <p className={styles.empty}>Учеников пока нет.</p>;
  }

  return (
    <ol className={styles.students}>
      {students.map((student, index) => (
        <li className={!student.isActive ? styles.inactive : undefined} key={student.id}>
          <span className={styles.number}>{String(index + 1).padStart(2, "0")}</span>
          <div className={styles.identity}>
            <strong>{student.name}</strong>
            <span>{student.login}</span>
          </div>
          <div aria-label={`Доступы: ${student.name}`} className={styles.grades}>
            {grades.map((grade) => {
              const enabled = student.gradeBands.includes(grade.code);
              return (
                <button
                  aria-label={`${grade.label}: ${enabled ? "доступ выдан" : "доступ закрыт"}`}
                  aria-pressed={enabled}
                  disabled={busy}
                  key={grade.code}
                  onClick={() => onSetAccess(student, grade.code, !enabled)}
                  type="button"
                >
                  {grade.short}
                </button>
              );
            })}
          </div>
          <button
            className={styles.activeButton}
            disabled={busy}
            onClick={() => onSetActive(student)}
            type="button"
          >
            {student.isActive ? "Отключить" : "Активировать"}
          </button>
        </li>
      ))}
    </ol>
  );
}

const mutationMessage = (error: Error | null) => {
  if (!error) return null;
  if (error instanceof ApiError && error.code === "LOGIN_TAKEN") {
    return "Этот логин уже занят.";
  }
  return "Не удалось сохранить изменения.";
};

export default function TeacherStudentsScreen() {
  const students = useTeacherStudents();
  const createStudent = useCreateStudent();
  const setActive = useSetStudentActive();
  const setAccess = useSetStudentAccess();
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    createStudent.mutate(
      {
        login: login.trim().toLowerCase(),
        password,
        firstName: firstName.trim() || null,
        lastName: lastName.trim() || null,
      },
      {
        onSuccess: () => {
          setLogin("");
          setPassword("");
          setFirstName("");
          setLastName("");
        },
      },
    );
  };

  const isBusy = createStudent.isPending || setActive.isPending || setAccess.isPending;
  const error = mutationMessage(createStudent.error || setActive.error || setAccess.error);

  return (
    <div className={styles.page}>
      <ContinuumHeader homeHref="/teacher" />
      <nav aria-label="Разделы учителя" className={styles.teacherNav}>
        <Link href="/teacher/materials">Материалы</Link>
        <Link aria-current="page" href="/teacher/students">Ученики и доступы</Link>
      </nav>
      <main className={styles.main}>
        <div className={styles.intro}>
          <h1>Ученики и доступы</h1>
          <p>Учётные записи учеников и доступ к материалам по классам.</p>
        </div>

        <form className={styles.createForm} onSubmit={submit}>
          <div className={styles.formHeading}>
            <strong>Новый ученик</strong>
            <span>Логин латиницей, пароль от 8 символов</span>
          </div>
          <input
            aria-label="Имя"
            autoComplete="off"
            maxLength={100}
            onChange={(event) => setFirstName(event.target.value)}
            placeholder="Имя"
            value={firstName}
          />
          <input
            aria-label="Фамилия"
            autoComplete="off"
            maxLength={100}
            onChange={(event) => setLastName(event.target.value)}
            placeholder="Фамилия"
            value={lastName}
          />
          <input
            aria-label="Логин"
            autoCapitalize="none"
            autoComplete="off"
            maxLength={64}
            minLength={3}
            onChange={(event) => setLogin(event.target.value)}
            pattern="[a-zA-Z0-9._-]+"
            placeholder="Логин"
            required
            title="Латинские буквы, цифры, точка, дефис или подчёркивание"
            value={login}
          />
          <input
            aria-label="Временный пароль"
            autoComplete="new-password"
            maxLength={128}
            minLength={8}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Временный пароль"
            required
            type="password"
            value={password}
          />
          <button disabled={isBusy || login.trim().length < 3 || password.length < 8} type="submit">
            {createStudent.isPending ? "Создаём…" : "Создать ученика"}
          </button>
        </form>

        {error ? <p className={styles.error}>{error}</p> : null}

        <section className={styles.roster}>
          <div className={styles.rosterHeading}>
            <div>
              <h2>Список учеников</h2>
              <span>Учётных записей: {students.data?.students.length ?? 0}</span>
            </div>
            <div className={styles.gradeLegend}>
              {grades.map((grade) => (
                <span key={grade.code}>{grade.short}</span>
              ))}
            </div>
          </div>
          {students.isPending ? <p className={styles.empty}>Загружаем учеников…</p> : null}
          {students.isError ? (
            <div className={styles.errorState} role="alert">
              <span>Не удалось загрузить учеников.</span>
              <button onClick={() => void students.refetch()} type="button">Повторить</button>
            </div>
          ) : null}
          {students.data ? (
            <StudentRows
              busy={isBusy}
              onSetAccess={(student, gradeBand, enabled) =>
                setAccess.mutate({ studentId: student.id, gradeBand, enabled })
              }
              onSetActive={(student) =>
                setActive.mutate({ studentId: student.id, input: { isActive: !student.isActive } })
              }
              students={students.data.students}
            />
          ) : null}
        </section>
      </main>
    </div>
  );
}
