"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Button from "@/components/ui/Button";
import {
  teacherApi,
  type StudentSummary,
  type TeacherReviewInboxItem,
  type TeacherReviewSubmissionStatus,
} from "@/lib/api/teacher";
import { getPhotoReviewStatusLabel } from "@/lib/status-labels";
import { formatApiErrorPayload } from "@/features/teacher-content/shared/api-errors";
import { buildReviewSearch, readReviewRouteFilters } from "./review-query";
import styles from "./teacher-review-inbox-panel.module.css";

const statusClassName: Record<TeacherReviewSubmissionStatus, string> = {
  pending_review: "statusPending",
  accepted: "statusAccepted",
  rejected: "statusRejected",
};

const sortLabel: Record<"oldest" | "newest", string> = {
  oldest: "Сначала старые",
  newest: "Сначала новые",
};

const formatDateTime = (value: string) =>
  new Date(value).toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

const getStudentName = (student: { firstName?: string | null; lastName?: string | null; login: string }) => {
  const parts = [student.lastName, student.firstName].filter(Boolean);
  return parts.length ? parts.join(" ") : student.login;
};

export default function TeacherReviewInboxPanel() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const filters = useMemo(() => readReviewRouteFilters(searchParams), [searchParams]);

  const [items, setItems] = useState<TeacherReviewInboxItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [students, setStudents] = useState<StudentSummary[]>([]);

  const loadInbox = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await teacherApi.listTeacherPhotoInbox({
        ...filters,
        limit: 50,
        offset: 0,
      });
      setItems(response.items);
      setTotal(response.total);
    } catch (err) {
      setItems([]);
      setTotal(0);
      setError(formatApiErrorPayload(err));
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    void loadInbox();
  }, [loadInbox]);

  useEffect(() => {
    let cancelled = false;

    const loadStudents = async () => {
      try {
        const response = await teacherApi.listStudents();
        if (cancelled) return;
        setStudents(response);
      } catch {
        if (cancelled) return;
        setStudents([]);
      }
    };

    void loadStudents();
    return () => {
      cancelled = true;
    };
  }, []);

  const updateFilters = useCallback(
    (patch: Partial<typeof filters>) => {
      const next = {
        ...filters,
        ...patch,
      };
      const search = buildReviewSearch(next);
      router.push(`/teacher/review${search ? `?${search}` : ""}`);
    },
    [filters, router],
  );

  const openSubmission = useCallback(
    (submissionId: string) => {
      const search = buildReviewSearch(filters);
      router.push(`/teacher/review/${submissionId}${search ? `?${search}` : ""}`);
    },
    [filters, router],
  );

  const resetFilters = useCallback(() => {
    const search = buildReviewSearch({ status: "pending_review", sort: "oldest" });
    router.push(`/teacher/review${search ? `?${search}` : ""}`);
  }, [router]);

  const hasExtendedFilters = Boolean(
    filters.studentId || filters.courseId || filters.sectionId || filters.unitId || filters.taskId,
  );

  return (
    <section className={styles.panel}>
      <header className={styles.header}>
        <div>
          <p className={styles.kicker}>Review Inbox</p>
          <h2 className={styles.title}>Проверка фото-отправок</h2>
          <p className={styles.subtitle}>Один поток проверки, без переключения в прогресс-дерево</p>
        </div>
        <div className={styles.headerActions}>
          <Button variant="ghost" onClick={loadInbox}>
            Обновить
          </Button>
          <Button
            onClick={() => {
              const first = items[0];
              if (!first) return;
              openSubmission(first.submissionId);
            }}
            disabled={!items.length}
          >
            Открыть первую на проверке
          </Button>
        </div>
      </header>

      <section className={styles.filters}>
        <label className={styles.filterField}>
          Статус
          <select
            className={styles.select}
            value={filters.status}
            onChange={(event) =>
              updateFilters({ status: event.target.value as TeacherReviewSubmissionStatus })
            }
          >
            <option value="pending_review">На проверке</option>
            <option value="accepted">Принято</option>
            <option value="rejected">Отклонено</option>
          </select>
        </label>

        <label className={styles.filterField}>
          Порядок
          <select
            className={styles.select}
            value={filters.sort}
            onChange={(event) => updateFilters({ sort: event.target.value as "oldest" | "newest" })}
          >
            <option value="oldest">{sortLabel.oldest}</option>
            <option value="newest">{sortLabel.newest}</option>
          </select>
        </label>

        <label className={styles.filterField}>
          Ученик
          <select
            className={styles.select}
            value={filters.studentId ?? ""}
            onChange={(event) =>
              updateFilters({
                studentId: event.target.value || undefined,
              })
            }
          >
            <option value="">Все ученики</option>
            {students.map((student) => (
              <option key={student.id} value={student.id}>
                {getStudentName(student)} ({student.login})
              </option>
            ))}
          </select>
        </label>

        {hasExtendedFilters ? (
          <Button variant="ghost" onClick={resetFilters}>
            Сбросить фильтры
          </Button>
        ) : null}
      </section>

      {filters.courseId || filters.sectionId || filters.unitId || filters.taskId ? (
        <div className={styles.contextChips}>
          {filters.courseId ? <span className={styles.chip}>Курс: {filters.courseId}</span> : null}
          {filters.sectionId ? <span className={styles.chip}>Раздел: {filters.sectionId}</span> : null}
          {filters.unitId ? <span className={styles.chip}>Юнит: {filters.unitId}</span> : null}
          {filters.taskId ? <span className={styles.chip}>Задача: {filters.taskId}</span> : null}
        </div>
      ) : null}

      {error ? (
        <div className={styles.error} role="status" aria-live="polite">
          {error}
        </div>
      ) : null}

      <div className={styles.totalLine}>
        <span>Найдено в очереди: {total}</span>
      </div>

      {loading ? <div className={styles.loading}>Загрузка очереди…</div> : null}

      {!loading && !items.length ? (
        <div className={styles.empty}>
          <p className={styles.emptyTitle}>Нет задач на проверке</p>
          <p className={styles.emptyHint}>Измените фильтры или дождитесь новых фото-отправок.</p>
          <Button variant="ghost" onClick={resetFilters}>
            Сбросить фильтры
          </Button>
        </div>
      ) : null}

      {!loading && items.length ? (
        <div className={styles.list}>
          {items.map((item) => (
            <article key={item.submissionId} className={styles.item}>
              <div className={styles.itemMain}>
                <div className={styles.itemHeader}>
                  <div className={styles.studentName}>{getStudentName(item.student)}</div>
                  <div className={styles.studentLogin}>@{item.student.login}</div>
                </div>

                <div className={styles.metaRow}>
                  <span className={`${styles.status} ${styles[statusClassName[item.status]]}`}>
                    {getPhotoReviewStatusLabel(item.status)}
                  </span>
                  <span>Отправлено: {formatDateTime(item.submittedAt)}</span>
                  <span>Файлов: {item.assetKeysCount}</span>
                </div>

                <div className={styles.pathRow}>
                  <span>{item.course.title}</span>
                  <span>/</span>
                  <span>{item.section.title}</span>
                  <span>/</span>
                  <span>{item.unit.title}</span>
                </div>

                <div className={styles.taskTitle}>{item.task.title ?? `Задача ${item.task.id}`}</div>
              </div>

              <div className={styles.itemActions}>
                <Button variant="ghost" onClick={() => openSubmission(item.submissionId)}>
                  Открыть
                </Button>
              </div>
            </article>
          ))}
        </div>
      ) : null}
    </section>
  );
}
