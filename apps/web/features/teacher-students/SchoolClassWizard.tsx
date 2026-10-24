"use client";

import { useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import { BulkCreateStudentsInputSchema, RosterStudentSchema, SCHOOL_ROSTER_LIMIT, parseRoster, type BulkCreateStudentsInput, type BulkCreateStudentsResult, type RosterStudent, type SchoolClass } from "@continuum/shared";
import StudentCredentials from "./StudentCredentials";
import StudentSelect from "./StudentSelect";
import { useBulkCreateStudents } from "./use-teacher-students";
import styles from "./school-classes.module.css";
import { ApiError } from "@/lib/api/client";
import { useConfirmation } from '@/components/ui/useConfirmation';

export function SchoolClassWizard({ classes, initialClassId = "new", onClose }: { classes: SchoolClass[]; initialClassId?: string; onClose: (classId?: string) => void }) {
  const confirmation = useConfirmation();
  const [step, setStep] = useState(0);
  const [classId, setClassId] = useState(initialClassId);
  const [title, setTitle] = useState("");
  const [grade, setGrade] = useState(8);
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear() - (now.getMonth() < 8 ? 1 : 0));
  const [text, setText] = useState("");
  const [rows, setRows] = useState<RosterStudent[]>([]);
  const [error, setError] = useState("");
  const [result, setResult] = useState<BulkCreateStudentsResult | null>(null);
  const request = useRef<BulkCreateStudentsInput | null>(null);
  const create = useBulkCreateStudents();
  const preview = parseRoster(text);
  const selected = classes.find((item) => item.id === classId);
  const classTitle = selected?.title ?? title;
  const labelYear = (value: number) => `${value}–${value + 1}`;

  const inputFor = (students: RosterStudent[]) => ({ requestId: request.current?.requestId ?? crypto.randomUUID(), students,
    ...(classId === "new" ? { newClass: { title, grade, academicYear: year } } : { classId }) });
  function review() {
    const parsed = BulkCreateStudentsInputSchema.safeParse(inputFor(preview));
    if (!parsed.success) { setError(`Укажите класс, имя и фамилию каждого ученика. В одном списке — от 1 до ${SCHOOL_ROSTER_LIMIT} учеников.`); return; }
    setRows(parsed.data.students); setError(""); request.current = null; setStep(1);
  }
  async function commit() {
    const parsed = BulkCreateStudentsInputSchema.safeParse(request.current ?? inputFor(rows));
    if (!parsed.success) { setError("Проверьте имя и фамилию в каждой строке."); return; }
    request.current = parsed.data;
    setError("");
    try { setResult(await create.mutateAsync(parsed.data)); setStep(2); }
    catch (reason) {
      if (reason instanceof ApiError && reason.status < 500) request.current = null;
      setError(reason instanceof Error ? reason.message : "Не удалось создать учеников. Повторите тот же запрос: дубликатов не будет.");
    }
    finally { create.reset(); }
  }
  function close() {
    const finish = () => onClose(result?.classId);
    if (request.current && !result) confirmation.ask({ title: 'Закрыть создание учеников?', description: 'Результат запроса ещё не подтверждён. Лучше вернуться и повторить тот же запрос: дубликатов не будет. После закрытия повторно показать пароли может быть невозможно.', confirmText: 'Всё равно закрыть', cancelText: 'Вернуться', destructive: true }, finish);
    else if (result?.credentials) confirmation.ask({ title: 'Закрыть доступы?', description: 'Сохраните логины и пароли перед закрытием. Повторно посмотреть пароли нельзя — только сбросить.', confirmText: 'Доступы сохранены', cancelText: 'Вернуться' }, finish);
    else finish();
  }
  function edit(index: number, field: keyof RosterStudent, value: string) {
    request.current = null;
    setRows((previous) => previous.map((row, i) => i === index ? { ...row, [field]: value } : row));
  }

  return <div className={styles.wizard}>
    <button className={styles.back} disabled={create.isPending} onClick={close}><ArrowLeft size={17} aria-hidden="true" />Ученики и доступы</button>
    <h1>Добавить учеников</h1>
    <ol className={styles.steps} aria-label="Этапы добавления">{["Класс и список", "Проверка списка", "Доступы"].map((label, index) => <li key={label} aria-current={step === index ? "step" : undefined} className={step > index ? styles.completed : undefined}>
      <span className={styles.stepNumber}>{step > index ? <Check size={17} aria-label="Завершено" /> : index + 1}</span><span>{label}</span>
    </li>)}</ol>
    {step === 0 && <>
      <div className={styles.classSelect}><label>Класс<StudentSelect value={classId} onChange={(event) => { setClassId(event.target.value); request.current = null; }}>
        <option value="new">Новый класс</option>{classes.filter((item) => !item.isArchived).map((item) => <option key={item.id} value={item.id}>{item.title} · {labelYear(item.academicYear)}</option>)}
      </StudentSelect></label></div>
      {classId === "new" ? <div className={styles.fields}>
        <label>Название<input placeholder="Например, 8А" value={title} maxLength={40} onChange={(event) => setTitle(event.target.value)} /></label>
        <label>Параллель<StudentSelect value={grade} onChange={(event) => setGrade(Number(event.target.value))}>{[7, 8, 9, 10, 11].map((value) => <option key={value} value={value}>{value} класс</option>)}</StudentSelect></label>
        <label>Учебный год<StudentSelect value={year} onChange={(event) => setYear(Number(event.target.value))}>{[year - 1, year, year + 1].map((value) => <option key={value} value={value}>{labelYear(value)}</option>)}</StudentSelect></label>
      </div> : <p className={styles.summary}>{selected?.grade} класс · {selected ? labelYear(selected.academicYear) : ""}</p>}
      <div className={styles.pasteGrid}><section><h2>Список учеников</h2><p className={styles.hint} id="roster-hint">Фамилия, имя, отчество — по одному ученику на строку.</p>
        <textarea aria-label="Список учеников" aria-describedby="roster-hint" value={text} maxLength={32000} onChange={(event) => setText(event.target.value)} placeholder={"Иванов Артём Сергеевич\nПетрова Мария Андреевна"} />
      </section><section><div className={styles.sectionHeading}><h2>Предпросмотр</h2><span>Учеников: {preview.length}</span></div>
        {preview.length ? <ol className={styles.preview}>{preview.slice(0, SCHOOL_ROSTER_LIMIT).map((row, index) => <li key={index}><span>{index + 1}</span><div>{[row.lastName, row.firstName, row.middleName].filter(Boolean).join(" ")}{!RosterStudentSchema.safeParse(row).success && <small className={styles.error}>Укажите имя и фамилию</small>}</div></li>)}</ol> : <p className={styles.empty}>Вставьте список — здесь появятся ученики.</p>}
      </section></div>
    </>}
    {step === 1 && <>
      <div className={styles.summary}><div><span>Класс</span><strong>{classTitle}</strong></div><div><span>Параллель</span><strong>{selected?.grade ?? grade} класс</strong></div><div><span>Учебный год</span><strong>{labelYear(selected?.academicYear ?? year)}</strong></div></div>
      <div className={styles.sectionHeading}><h2>Проверьте список</h2><span>Учеников: {rows.length}</span></div>
      <div className={styles.tableWrap}><table className={styles.table}><thead><tr><th>№</th><th>Фамилия</th><th>Имя</th><th>Отчество</th></tr></thead><tbody>{rows.map((row, index) => <tr key={index}><td>{index + 1}</td>{(["lastName", "firstName", "middleName"] as const).map((field) => <td key={field}><input aria-label={`${field === "lastName" ? "Фамилия" : field === "firstName" ? "Имя" : "Отчество"}, строка ${index + 1}`} value={row[field]} maxLength={100} disabled={create.isPending || Boolean(request.current)} onChange={(event) => edit(index, field, event.target.value)} /></td>)}</tr>)}</tbody></table></div>
      <p className={styles.hint}>Совпадение ФИО не объединяет учеников. Доступ к материалам {((selected?.grade ?? grade) >= 10) ? "10–11 классов" : `${selected?.grade ?? grade} класса`} откроется автоматически.</p>
    </>}
    {error && <p className={styles.error} role="alert">{error}</p>}
    {step < 2 && <div className={styles.footer}><p className={styles.hint}>Логины и начальные пароли создадим автоматически после проверки списка.</p><div className={styles.actions}>
      {step === 1 && <button className={styles.secondary} disabled={create.isPending || Boolean(request.current)} onClick={() => { setText(rows.map((row) => [row.lastName, row.firstName, row.middleName].filter(Boolean).join(" ")).join("\n")); setStep(0); setError(""); }}>Назад</button>}
      <button className={styles.secondary} disabled={create.isPending} onClick={close}>Отмена</button>
      <button className={styles.primary} disabled={create.isPending || (step === 0 && !preview.length)} onClick={step === 0 ? review : () => void commit()}>
        {create.isPending ? "Создаём учеников…" : step === 0 ? <>Проверить список<ArrowRight size={17} aria-hidden="true" /></> : request.current ? "Повторить запрос" : classId === "new" ? "Создать класс и учеников" : "Создать учеников"}
      </button>
    </div></div>}
    {step === 2 && result && (result.credentials ? <StudentCredentials credentials={result.credentials} classTitle={classTitle} onDone={close} /> : <section className={styles.notice}><h2>Ученики уже созданы</h2><p>Повторный запрос не создал дубликаты. Пароли повторно не выдаются. Если доступы не сохранились, сбросьте пароли нужным ученикам в списке.</p><button className={styles.primary} onClick={close}>К списку учеников</button></section>)}
    {confirmation.dialog}
  </div>;
}
