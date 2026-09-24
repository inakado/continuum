"use client";

import type { ChangeEvent, FormEvent } from "react";
import { useMemo, useRef, useState } from "react";
import type {
  GradeBand,
  LessonArtifact,
  LessonArtifactType,
  LibrarySection,
} from "@continuum/shared";
import {
  ChevronDown,
  ChevronRight,
  FileArchive,
  FileText,
  Pencil,
  Plus,
  Upload,
} from "lucide-react";
import Link from "next/link";
import ContinuumHeader from "@/components/ContinuumHeader";
import { teacherLibraryApi } from "./teacher-library.api";
import {
  useCreateLesson,
  useCreateSection,
  usePublishLesson,
  usePublishSection,
  useTeacherLesson,
  useTeacherLibrary,
  useUpdateLesson,
  useUpdateSection,
  useUploadLessonArtifact,
} from "./use-teacher-library";
import styles from "./teacher-library.module.css";

const gradeTabs: Array<{ code: GradeBand; label: string }> = [
  { code: "grade_7", label: "7 класс" },
  { code: "grade_8", label: "8 класс" },
  { code: "grade_9", label: "9 класс" },
  { code: "grade_10_11", label: "10–11 классы" },
];

const formatLabels: Array<{ key: keyof LibrarySection["lessons"][number]["formats"]; label: string }> = [
  { key: "pdf", label: "PDF" },
  { key: "interactive", label: "Интерактив" },
  { key: "tasks", label: "Задачи" },
];

const lessonCount = (count: number) => {
  const lastTwo = count % 100;
  const last = count % 10;
  const noun = lastTwo >= 11 && lastTwo <= 14 ? "занятий" : last === 1 ? "занятие" : last >= 2 && last <= 4 ? "занятия" : "занятий";
  return `${count} ${noun}`;
};

function NewLessonForm({ sectionId }: { sectionId: string }) {
  const [title, setTitle] = useState("");
  const createLesson = useCreateLesson();

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalizedTitle = title.trim();
    if (!normalizedTitle) return;
    createLesson.mutate(
      { sectionId, title: normalizedTitle },
      { onSuccess: () => setTitle("") },
    );
  };

  return (
    <form className={styles.lessonForm} onSubmit={submit}>
      <Plus aria-hidden="true" size={17} strokeWidth={1.8} />
      <label className={styles.visuallyHidden} htmlFor={`lesson-${sectionId}`}>
        Название нового занятия
      </label>
      <input
        id={`lesson-${sectionId}`}
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        placeholder="Добавить занятие"
        maxLength={200}
      />
      <button disabled={createLesson.isPending || title.trim().length === 0} type="submit">
        {createLesson.isPending ? "Добавляем…" : "Добавить"}
      </button>
      {createLesson.isError ? (
        <span className={styles.formError} role="alert">Не удалось добавить занятие.</span>
      ) : null}
    </form>
  );
}

function SectionTitle({ section }: { section: LibrarySection }) {
  const updateSection = useUpdateSection();
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(section.title);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalized = title.trim();
    if (!normalized) return;
    updateSection.mutate(
      { sectionId: section.id, title: normalized },
      { onSuccess: () => setEditing(false) },
    );
  };

  if (editing) {
    return (
      <form className={styles.inlineEdit} onSubmit={submit} onClick={(event) => event.stopPropagation()}>
        <input
          aria-label="Название раздела"
          autoFocus
          maxLength={160}
          onChange={(event) => setTitle(event.target.value)}
          value={title}
        />
        <button disabled={updateSection.isPending || !title.trim()} type="submit">Сохранить</button>
        <button className={styles.cancelButton} onClick={() => setEditing(false)} type="button">Отмена</button>
      </form>
    );
  }

  return (
    <div className={styles.sectionTitleLine}>
      <h2>{section.title}</h2>
      <button
        aria-label={`Переименовать раздел «${section.title}»`}
        className={styles.iconButton}
        onClick={(event) => {
          event.stopPropagation();
          setTitle(section.title);
          setEditing(true);
        }}
        type="button"
      >
        <Pencil aria-hidden="true" size={16} strokeWidth={1.7} />
      </button>
    </div>
  );
}

type SectionBlockProps = {
  section: LibrarySection;
  open: boolean;
  selectedLessonId: string | null;
  onToggle: () => void;
  onSelectLesson: (lessonId: string) => void;
};

function SectionBlock({ section, open, selectedLessonId, onToggle, onSelectLesson }: SectionBlockProps) {
  const publishSection = usePublishSection();

  return (
    <section className={styles.section}>
      <div className={styles.sectionHeading}>
        <button
          aria-expanded={open}
          aria-label={`${open ? "Свернуть" : "Развернуть"} раздел «${section.title}»`}
          className={styles.sectionToggle}
          onClick={onToggle}
          type="button"
        >
          {open ? <ChevronDown aria-hidden="true" size={20} /> : <ChevronRight aria-hidden="true" size={20} />}
        </button>
        <SectionTitle section={section} />
        <span className={styles.sectionMeta}>
          {section.status === "published" ? "Опубликован" : "Черновик"} · {lessonCount(section.lessons.length)}
        </span>
        {section.status === "draft" ? (
          <button
            className={styles.textAction}
            disabled={publishSection.isPending}
            onClick={() => publishSection.mutate(section.id)}
            type="button"
          >
            Опубликовать
          </button>
        ) : null}
      </div>

      {open ? (
        <div className={styles.sectionBody}>
          <ol className={styles.lessons}>
            {section.lessons.map((lesson, index) => (
              <li key={lesson.id} className={lesson.id === selectedLessonId ? styles.selectedLesson : undefined}>
                <button className={styles.lessonSelect} onClick={() => onSelectLesson(lesson.id)} type="button">
                  <span className={styles.number}>{index + 1}</span>
                  <span className={styles.lessonTitle}>{lesson.title}</span>
                  <span className={styles.formatColumns}>
                    {formatLabels.map((format) => (
                      <span className={styles.formatSlot} key={format.key}>
                        {lesson.formats[format.key] ? format.label : ""}
                      </span>
                    ))}
                  </span>
                  <span className={styles.lessonStatus}>
                    {lesson.status === "published" ? "Опубликовано" : "Черновик"}
                  </span>
                </button>
              </li>
            ))}
          </ol>
          <NewLessonForm sectionId={section.id} />
        </div>
      ) : null}
    </section>
  );
}

type ArtifactSlotProps = {
  artifact?: LessonArtifact;
  lessonId: string;
  type: LessonArtifactType;
  title: string;
};

function ArtifactSlot({ artifact, lessonId, type, title }: ArtifactSlotProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const uploadArtifact = useUploadLessonArtifact();
  const [opening, setOpening] = useState(false);
  const isInteractive = type === "interactive";

  const upload = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    uploadArtifact.mutate({ lessonId, type, file });
    event.target.value = "";
  };

  const open = async () => {
    if (!artifact) return;
    const tab = window.open("", "_blank");
    setOpening(true);
    try {
      const result = await teacherLibraryApi.getArtifactView(artifact.id);
      if (tab) tab.location.replace(result.url);
      else window.location.assign(result.url);
    } catch {
      tab?.close();
      setOpening(false);
      return;
    } finally {
      setOpening(false);
    }
  };

  return (
    <section className={styles.artifactSlot}>
      <h3>{title}</h3>
      {artifact ? (
        <div className={styles.artifactFile}>
          {isInteractive ? (
            <FileArchive aria-hidden="true" size={32} strokeWidth={1.5} />
          ) : (
            <FileText aria-hidden="true" size={32} strokeWidth={1.5} />
          )}
          <div>
            <strong>{artifact.filename}</strong>
            <span>Версия {artifact.version}{artifact.status === "draft" ? " · черновик" : ""}</span>
          </div>
        </div>
      ) : (
        <div className={styles.artifactEmpty}>
          <Upload aria-hidden="true" size={25} strokeWidth={1.5} />
          <span>{isInteractive ? "Интерактивная лекция не добавлена" : "PDF-файл не добавлен"}</span>
        </div>
      )}
      {isInteractive ? <p className={styles.artifactNote}>ZIP можно сохранить здесь. Публикация и просмотр учениками появятся после подключения защищённого проигрывателя.</p> : null}
      <div className={styles.artifactActions}>
        <input
          accept={isInteractive ? ".zip,application/zip,application/x-zip-compressed" : ".pdf,application/pdf"}
          aria-label={`${title}: выберите файл`}
          className={styles.visuallyHidden}
          onChange={upload}
          ref={inputRef}
          type="file"
        />
        <button disabled={uploadArtifact.isPending} onClick={() => inputRef.current?.click()} type="button">
          {uploadArtifact.isPending ? "Загружаем…" : artifact ? "Заменить" : isInteractive ? "Загрузить пакет" : "Загрузить PDF"}
        </button>
        {artifact ? <button disabled={opening} onClick={() => void open()} type="button">{opening ? "Открываем…" : isInteractive ? "Скачать пакет" : "Открыть PDF"}</button> : null}
      </div>
      {uploadArtifact.isError ? <p className={styles.formError} role="alert">Не удалось загрузить файл.</p> : null}
    </section>
  );
}

function LessonInspector({ lessonId, sectionStatus }: { lessonId: string | null; sectionStatus: LibrarySection["status"] | null }) {
  const query = useTeacherLesson(lessonId);
  const updateLesson = useUpdateLesson();
  const publishLesson = usePublishLesson();
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState("");

  if (!lessonId) {
    return <aside className={styles.inspectorEmpty}>Выберите занятие, чтобы добавить материалы.</aside>;
  }
  if (query.isPending) return <aside className={styles.inspectorEmpty}>Загружаем занятие…</aside>;
  if (!query.data) return <aside className={styles.inspectorEmpty}>Не удалось загрузить занятие.</aside>;

  const latestArtifact = (type: LessonArtifactType) =>
    query.data.artifacts
      .filter((artifact) => artifact.type === type)
      .sort((left, right) => right.version - left.version)[0];

  const saveTitle = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalized = title.trim();
    if (!normalized) return;
    updateLesson.mutate(
      { lessonId, title: normalized },
      { onSuccess: () => setEditing(false) },
    );
  };

  return (
    <aside className={styles.inspector}>
      <div className={styles.inspectorHeader}>
        {editing ? (
          <form className={styles.inspectorTitleEdit} onSubmit={saveTitle}>
            <input autoFocus maxLength={200} onChange={(event) => setTitle(event.target.value)} value={title} />
            <button disabled={updateLesson.isPending || !title.trim()} type="submit">Сохранить</button>
            <button className={styles.cancelButton} onClick={() => setEditing(false)} type="button">Отмена</button>
          </form>
        ) : (
          <div className={styles.inspectorTitle}>
            <h2>{query.data.title}</h2>
            <button
              aria-label="Переименовать занятие"
              className={styles.iconButton}
              onClick={() => {
                setTitle(query.data.title);
                setEditing(true);
              }}
              type="button"
            >
              <Pencil aria-hidden="true" size={17} strokeWidth={1.7} />
            </button>
          </div>
        )}
        <div className={styles.inspectorState}>
          <span>{query.data.status === "published" ? "Опубликовано" : "Черновик"}</span>
          {query.data.status === "draft" || query.data.artifacts.some((artifact) => artifact.status === "draft" && artifact.type !== "interactive") ? (
            <button
              disabled={publishLesson.isPending || sectionStatus !== "published"}
              onClick={() => publishLesson.mutate(lessonId)}
              title={sectionStatus === "draft" ? "Сначала опубликуйте раздел" : undefined}
              type="button"
            >
              {publishLesson.isPending ? "Публикуем…" : "Опубликовать"}
            </button>
          ) : null}
        </div>
      </div>
      {publishLesson.isError ? <p className={styles.formError} role="alert">Не удалось опубликовать занятие.</p> : null}

      <ArtifactSlot artifact={latestArtifact("pdf")} lessonId={lessonId} title="Конспект PDF" type="pdf" />
      <ArtifactSlot artifact={latestArtifact("interactive")} lessonId={lessonId} title="Интерактивная лекция" type="interactive" />
      <ArtifactSlot artifact={latestArtifact("tasks_pdf")} lessonId={lessonId} title="Задачи PDF" type="tasks_pdf" />
    </aside>
  );
}

export default function TeacherMaterialsScreen() {
  const library = useTeacherLibrary();
  const createSection = useCreateSection();
  const [selectedGrade, setSelectedGrade] = useState<GradeBand>("grade_10_11");
  const [selectedLessonId, setSelectedLessonId] = useState<string | null>(null);
  const [expandedSectionId, setExpandedSectionId] = useState<string | null | "none">(null);
  const [showSectionForm, setShowSectionForm] = useState(false);
  const [sectionTitle, setSectionTitle] = useState("");

  const activeGrade = library.data?.gradeBands.find((band) => band.code === selectedGrade);
  const allLessons = useMemo(
    () => activeGrade?.sections.flatMap((section) => section.lessons) ?? [],
    [activeGrade],
  );
  const resolvedLessonId = allLessons.some((lesson) => lesson.id === selectedLessonId)
    ? selectedLessonId
    : (allLessons[0]?.id ?? null);
  const selectedSection = activeGrade?.sections.find((section) =>
    section.lessons.some((lesson) => lesson.id === resolvedLessonId),
  );
  const resolvedExpandedSectionId = expandedSectionId === "none" ? null : expandedSectionId && activeGrade?.sections.some((section) => section.id === expandedSectionId)
    ? expandedSectionId
    : (selectedSection?.id ?? activeGrade?.sections[0]?.id ?? null);

  const submitSection = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalizedTitle = sectionTitle.trim();
    if (!normalizedTitle) return;
    createSection.mutate(
      { gradeBand: selectedGrade, title: normalizedTitle },
      {
        onSuccess: (section) => {
          setSectionTitle("");
          setShowSectionForm(false);
          setExpandedSectionId(section.id);
        },
      },
    );
  };

  return (
    <div className={styles.page}>
      <ContinuumHeader homeHref="/teacher" />
      <nav aria-label="Разделы учителя" className={styles.teacherNav}>
        <Link aria-current="page" href="/teacher/materials">Материалы</Link>
        <Link href="/teacher/students">Ученики и доступы</Link>
      </nav>
      <nav aria-label="Классы" className={styles.gradeNav}>
        {gradeTabs.map((grade) => (
          <button
            aria-current={selectedGrade === grade.code ? "page" : undefined}
            key={grade.code}
            onClick={() => {
              setSelectedGrade(grade.code);
              setSelectedLessonId(null);
              setExpandedSectionId(null);
            }}
            type="button"
          >
            {grade.label}
          </button>
        ))}
      </nav>

      <main className={styles.workspace}>
        <div className={styles.catalogPane}>
          <div className={styles.intro}>
            <div>
              <h1>Материалы</h1>
              <p>Создавайте и редактируйте учебные материалы для своих классов</p>
            </div>
            <button className={styles.primaryButton} onClick={() => setShowSectionForm(true)} type="button">
              Добавить раздел
            </button>
          </div>

          {showSectionForm ? (
            <form className={styles.sectionForm} onSubmit={submitSection}>
              <label htmlFor="section-title">Название раздела</label>
              <input
                autoFocus
                id="section-title"
                maxLength={160}
                onChange={(event) => setSectionTitle(event.target.value)}
                placeholder="Например, Механика"
                value={sectionTitle}
              />
              <button disabled={createSection.isPending || !sectionTitle.trim()} type="submit">
                {createSection.isPending ? "Создаём…" : "Создать"}
              </button>
              <button className={styles.cancelButton} onClick={() => setShowSectionForm(false)} type="button">Отмена</button>
              {createSection.isError ? <span className={styles.formError}>Не удалось создать раздел.</span> : null}
            </form>
          ) : null}

          {library.isPending ? <div className={styles.state}>Загружаем материалы…</div> : null}
          {library.isError ? (
            <div className={styles.state} role="alert">
              <span>Не удалось загрузить материалы.</span>
              <button onClick={() => void library.refetch()} type="button">Повторить</button>
            </div>
          ) : null}
          {activeGrade ? (
            activeGrade.sections.length === 0 ? (
              <div className={styles.emptyState}>
                <h2>В этом классе пока нет разделов</h2>
                <button onClick={() => setShowSectionForm(true)} type="button">Добавить первый раздел</button>
              </div>
            ) : (
              <div className={styles.sections}>
                {activeGrade.sections.map((section) => (
                  <SectionBlock
                    key={section.id}
                    onSelectLesson={(lessonId) => {
                      setSelectedLessonId(lessonId);
                      setExpandedSectionId(section.id);
                    }}
                    onToggle={() => setExpandedSectionId(
                      resolvedExpandedSectionId === section.id ? "none" : section.id,
                    )}
                    open={resolvedExpandedSectionId === section.id}
                    section={section}
                    selectedLessonId={resolvedLessonId}
                  />
                ))}
              </div>
            )
          ) : null}
        </div>
        <LessonInspector lessonId={resolvedLessonId} sectionStatus={selectedSection?.status ?? null} />
      </main>
    </div>
  );
}
