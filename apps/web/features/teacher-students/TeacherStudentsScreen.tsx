"use client";

import { useRef, useState } from "react";
import { useBulkDelete } from '@/features/teacher-bulk-actions/use-bulk-delete';
import { SelectionCheckbox } from '@/features/teacher-bulk-actions/BulkActionBar';
import { teacherStudentsQueryKeys } from '@/lib/query/keys';
import { teacherStudentsApi } from './teacher-students.api';
import { MoreHorizontal } from "lucide-react";
import type { GradeBand, SchoolClass, StudentCredential, TeacherStudent } from "@continuum/shared";
import TeacherChrome from '@/features/teacher-shell/TeacherChrome';
import { useSchoolClasses, useSetStudentAccess, useSetStudentActive, useSetStudentClass, useTeacherStudents, useUpdateSchoolClass, useResetStudentPassword, useDeleteSchoolClass } from "./use-teacher-students";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/DropdownMenu";
import { SchoolClassWizard } from "./SchoolClassWizard";
import StudentCredentials from "./StudentCredentials";
import SingleStudentForm from "./SingleStudentForm";
import StudentSelect from "./StudentSelect";
import DeleteClassPanel from "./DeleteClassPanel";
import StudentNamesForm from "./StudentNamesForm";
import styles from "./teacher-students.module.css";
import ui from "./school-classes.module.css";
import { useConfirmation } from '@/components/ui/useConfirmation';
import SearchField from '@/components/ui/SearchField';

const grades: Array<{ code: GradeBand; short: string; label: string }> = [
  { code: "grade_7", short: "7", label: "7 класс" },
  { code: "grade_8", short: "8", label: "8 класс" },
  { code: "grade_9", short: "9", label: "9 класс" },
  { code: "grade_10_11", short: "10–11", label: "10–11 класс" },
];

type StudentRowsProps = {
  students: TeacherStudent[]; busy: boolean; classes?: SchoolClass[];
  selection?: { ids: Set<string>; toggle: (id: string) => void; canSelect: (id: string) => boolean };
  onSetActive: (student: TeacherStudent) => void;
  onSetAccess: (student: TeacherStudent, gradeBand: GradeBand, enabled: boolean) => void;
  onSetClass?: (student: TeacherStudent, classId: string | null) => void;
  onResetPassword?: (student: TeacherStudent, returnFocus?: () => void) => void;
  onDelete?: (student: TeacherStudent, returnFocus?: () => void) => void;
};
function StudentActions({ student, busy, onSetActive, onSetClass, onResetPassword, onDelete }: Pick<StudentRowsProps, 'busy' | 'onSetActive' | 'onSetClass' | 'onResetPassword' | 'onDelete'> & { student: TeacherStudent }) {
  const [editing, setEditing] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const confirming = useRef(false);
  return <div className={styles.rowActions}><DropdownMenu>
    <DropdownMenuTrigger asChild><button ref={trigger} disabled={busy} aria-label={`Действия: ${student.name}`} type="button"><MoreHorizontal size={19} aria-hidden="true" /></button></DropdownMenuTrigger>
    <DropdownMenuContent className={styles.studentMenu} align="end" onCloseAutoFocus={(event) => { if (editing || confirming.current) event.preventDefault(); confirming.current = false; }}>
      <DropdownMenuItem onSelect={() => setEditing(true)}>Изменить данные</DropdownMenuItem>
      {onResetPassword && <DropdownMenuItem onSelect={() => { confirming.current = true; onResetPassword(student, () => trigger.current?.focus()); }}>Сбросить пароль</DropdownMenuItem>}
      {onSetClass && student.classId && <DropdownMenuItem onSelect={() => onSetClass(student, null)}>Убрать из класса</DropdownMenuItem>}
      <DropdownMenuItem onSelect={() => onSetActive(student)}>{student.isActive ? "Отключить" : "Активировать"}</DropdownMenuItem>
      {onDelete && <DropdownMenuItem className={styles.deleteItem} onSelect={() => { confirming.current = true; onDelete(student, () => trigger.current?.focus()); }}>Удалить ученика</DropdownMenuItem>}
    </DropdownMenuContent>
  </DropdownMenu>{editing && <StudentNamesForm student={student} onClose={() => setEditing(false)} returnFocus={() => trigger.current?.focus()} />}</div>;
}
export function StudentRows({ students, busy, classes = [], selection, onSetActive, onSetAccess, onSetClass, onResetPassword, onDelete }: StudentRowsProps) {
  if (!students.length) return <p className={styles.empty}>Ученики не найдены. Добавьте ученика или измените фильтр.</p>;
  return <ol className={styles.students}>{students.map((student, index) => <li key={student.id}>
    <span className={styles.number}>{selection ? <SelectionCheckbox label={`Выбрать ученика: ${student.name}`} checked={selection.ids.has(student.id)} disabled={busy || !selection.canSelect(student.id)} onChange={() => selection.toggle(student.id)} /> : index + 1}</span>
    <div className={styles.identity}><strong>{student.lastName && student.firstName ? [student.lastName, student.firstName, student.middleName].filter(Boolean).join(" ") : student.name}</strong><span>{student.login}{!student.isActive && " · Отключён"}</span></div>
    {onSetClass && <StudentSelect aria-label={`Класс: ${student.name}`} disabled={busy} value={student.classId ?? ""} onChange={(event) => onSetClass(student, event.target.value || null)}>
      <option value="">Без класса</option>{classes.filter((item) => !item.isArchived || item.id === student.classId).map((item) => <option key={item.id} value={item.id}>{item.title} · {item.academicYear}{item.isArchived ? " · Архив" : ""}</option>)}
    </StudentSelect>}
    <div aria-label={`Доступ к материалам: ${student.name}`} className={styles.grades}>{grades.map((grade) => {
      const enabled = student.gradeBands.includes(grade.code);
      return <button aria-label={`${grade.label}: ${enabled ? "доступ выдан" : "доступ закрыт"}`} aria-pressed={enabled} disabled={busy} key={grade.code} onClick={() => onSetAccess(student, grade.code, !enabled)} type="button">{grade.short}</button>;
    })}</div>
    <StudentActions student={student} busy={busy} onSetActive={onSetActive} onSetClass={onSetClass} onResetPassword={onResetPassword} onDelete={onDelete} />
  </li>)}</ol>;
}

export default function TeacherStudentsScreen() {
  const confirmation = useConfirmation();
  const students = useTeacherStudents();
  const classes = useSchoolClasses();
  const setActive = useSetStudentActive();
  const setAccess = useSetStudentAccess();
  const setClass = useSetStudentClass();
  const updateClass = useUpdateSchoolClass();
  const reset = useResetStudentPassword();
  const deleteClass = useDeleteSchoolClass();
  const resetRequest = useRef<{ studentId: string; requestId: string } | null>(null);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [mode, setMode] = useState<"list" | "single" | "bulk">("list");
  const [editingClass, setEditingClass] = useState(false);
  const [deletingClass, setDeletingClass] = useState(false);
  const [credential, setCredential] = useState<StudentCredential | null>(null);
  const [passwordError, setPasswordError] = useState("");
  const schoolClasses = classes.data?.classes ?? [];
  const currentClasses = schoolClasses.filter((item) => !item.isArchived);
  const archivedClasses = schoolClasses.filter((item) => item.isArchived);
  const selected = schoolClasses.find((item) => item.id === filter);
  const otherBusy = setActive.isPending || setAccess.isPending || setClass.isPending || updateClass.isPending || reset.isPending || deleteClass.isPending;
  const error = setActive.error || setAccess.error || setClass.error || updateClass.error || deleteClass.error;
  const roster = (students.data?.students ?? []).filter((student) =>
    (filter === "all" || (filter === "none" ? !student.classId : student.classId === filter)) &&
    `${student.name} ${student.login}`.toLocaleLowerCase("ru").includes(search.toLocaleLowerCase("ru")));

  const bulk = useBulkDelete({ scope: JSON.stringify([filter, search]), items: roster, queryKey: teacherStudentsQueryKeys.all(), label: student => student.name,
    title: 'Удалить выбранных учеников?', description: 'Ученики исчезнут из списка и не смогут войти. Пароли, классы, доступы и результаты сохранятся. После удаления можно отменить всю операцию.',
    remove: items => teacherStudentsApi.removeMany({ items: items.map(student => ({ id: student.id, expectedRevision: student.lifecycleRevision ?? 1 })) }),
    restore: receipt => teacherStudentsApi.restoreMany(receipt),
  });
  const busy = otherBusy || bulk.busy;

  async function resetPassword(student: TeacherStudent) {
    if (resetRequest.current?.studentId !== student.id) {
      resetRequest.current = { studentId: student.id, requestId: crypto.randomUUID() };
    }
    setPasswordError("");
    try {
      const result = await reset.mutateAsync(resetRequest.current);
      resetRequest.current = null;
      if (result.credential) setCredential(result.credential);
      else setPasswordError("Пароль уже был сброшен. Если доступы не сохранились, выполните новый сброс.");
    }
    finally { reset.reset(); }
  }
  function changeFilter(value: string) { setFilter(value); setEditingClass(false); setDeletingClass(false); }

  return <div className={styles.page}>
    <TeacherChrome active="students" />
    <main className={styles.main}>
      {mode === "bulk" ? <SchoolClassWizard classes={schoolClasses} initialClassId={selected && !selected.isArchived ? selected.id : "new"} onClose={(id) => { setMode("list"); if (id) changeFilter(id); }} /> : credential ?
        <StudentCredentials credentials={[credential]} classTitle={selected?.title ?? "Ученик"} onDone={() => confirmation.ask({ title: 'Закрыть доступы?', description: 'Сохраните логин и пароль перед закрытием. Повторно посмотреть пароль нельзя — только сбросить.', confirmText: 'Доступы сохранены', cancelText: 'Вернуться' }, () => setCredential(null))} /> : mode === "single" ?
        <SingleStudentForm onClose={() => setMode("list")} /> : <div className={ui.workspace}>
        <div className={ui.sectionHeading}><div className={styles.intro}><h1>Ученики и доступы</h1><p>Классы, учётные записи и доступ к материалам</p></div><div className={ui.actions}>
          <button className={ui.secondary} onClick={() => setMode("single")}>Добавить ученика</button>
          <button className={ui.primary} disabled={!classes.data} onClick={() => setMode("bulk")}>Добавить списком</button>
        </div></div>
        <div className={ui.toolbar}>
          <label>Класс<StudentSelect value={filter} onChange={(event) => changeFilter(event.target.value)}>
            <option value="all">Все ученики</option><option value="none">Без класса</option>
            {currentClasses.length > 0 && <optgroup label="Текущие классы">
              {currentClasses.map((item) => <option key={item.id} value={item.id}>{item.title} · {item.academicYear}–{item.academicYear + 1}</option>)}
            </optgroup>}
            {archivedClasses.length > 0 && <optgroup label="Архивные классы">
              {archivedClasses.map((item) => <option key={item.id} value={item.id}>{item.title} · {item.academicYear}–{item.academicYear + 1} · Архив</option>)}
            </optgroup>}
          </StudentSelect></label>
          <label>Поиск<SearchField label="Поиск" placeholder="ФИО или логин" value={search} onValueChange={setSearch} /></label>
        </div>
        {selected && <div className={ui.classHeading}><div><h2>{selected.title}{selected.isArchived ? " · Архив" : ""}</h2><p>{selected.grade} класс · {selected.academicYear}–{selected.academicYear + 1} · Учеников: {selected.studentCount}</p></div><div className={ui.actions}>
          <button className={ui.back} onClick={() => setEditingClass(!editingClass)}>{editingClass ? "Отменить" : "Изменить класс"}</button>
          <button className={ui.back} disabled={busy} onClick={() => { if (selected.isArchived) updateClass.mutate({ id: selected.id, input: { isArchived: false } }); else confirmation.ask({ title: 'Архивировать класс?', description: `«${selected.title}» перейдёт в архив. Ученики и их доступы сохранятся, добавление в этот класс будет недоступно. Класс можно восстановить.`, confirmText: 'В архив' }, () => updateClass.mutateAsync({ id: selected.id, input: { isArchived: true } })); }}>{selected.isArchived ? "Восстановить" : "В архив"}</button>
          <button className={ui.dangerLink} disabled={busy} onClick={() => { setDeletingClass(!deletingClass); setEditingClass(false); }}>Удалить класс</button>
        </div></div>}
        {deletingClass && selected && <DeleteClassPanel key={selected.id} schoolClass={selected} busy={busy} onCancel={() => setDeletingClass(false)} onConfirm={(deleteStudents) => deleteClass.mutate({ id: selected.id, deleteStudents }, { onSuccess: () => changeFilter("all") })} />}
        {editingClass && selected && <form key={selected.id} className={ui.toolbar} onSubmit={(event) => {
          event.preventDefault(); const form = new FormData(event.currentTarget);
          updateClass.mutate({ id: selected.id, input: { title: String(form.get("title")).trim(), grade: Number(form.get("grade")), academicYear: Number(form.get("year")) } }, { onSuccess: () => setEditingClass(false) });
        }}><label>Название<input name="title" defaultValue={selected.title} maxLength={40} required /></label><label>Параллель<StudentSelect name="grade" defaultValue={selected.grade}>{[7, 8, 9, 10, 11].map((value) => <option key={value} value={value}>{value} класс</option>)}</StudentSelect></label><label>Начало учебного года<input name="year" type="number" min={2020} max={2100} defaultValue={selected.academicYear} required /></label><button className={ui.primary} disabled={busy}>Сохранить</button></form>}
        {bulk.notices}
        {error && <p className={ui.error} role="alert">{error.message}</p>}{passwordError && <p className={ui.error} role="alert">{passwordError}</p>}
        {students.isPending || classes.isPending ? <p className={styles.empty}>Загружаем учеников и классы…</p> : students.isError || classes.isError ? <div className={ui.notice} role="alert">Не удалось загрузить данные. <button className={ui.back} onClick={() => { void students.refetch(); void classes.refetch(); }}>Повторить</button></div> : <section className={styles.roster}>
          <div className={styles.rosterHeading}><h2>Ученики</h2><span>Всего: {roster.length}</span></div>{bulk.bar}
          <StudentRows selection={bulk} students={roster} classes={schoolClasses} busy={busy} onDelete={(student, returnFocus) => bulk.ask([student], returnFocus)} onSetClass={(student, classId) => setClass.mutate({ studentId: student.id, classId })} onResetPassword={(student, returnFocus) => confirmation.ask({ title: 'Сбросить пароль?', description: `«${student.name}»: прежний пароль перестанет работать, все сеансы ученика будут завершены. Новый пароль нужно будет сохранить и передать ученику.`, confirmText: 'Сбросить пароль', destructive: true, returnFocus }, () => resetPassword(student))} onSetActive={(student) => setActive.mutate({ studentId: student.id, input: { isActive: !student.isActive } })} onSetAccess={(student, gradeBand, enabled) => setAccess.mutate({ studentId: student.id, gradeBand, enabled })} />
        </section>}
      </div>}
    </main>
    {confirmation.dialog}{bulk.dialog}
  </div>;
}
