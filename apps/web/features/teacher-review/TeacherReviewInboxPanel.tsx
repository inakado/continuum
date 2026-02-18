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

const getTaskDisplayLabel = (task: { sortOrder: number }) => String(task.sortOrder + 1);

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

  const hasAnyCustomFilters = Boolean(
    filters.status !== "pending_review" ||
      filters.sort !== "oldest" ||
      filters.studentId ||
      filters.courseId ||
      filters.sectionId ||
      filters.unitId ||
      filters.taskId,
  );

  return (
    <section className={styles.panel}>
      <header className={styles.toolbar}>
        <div className={styles.totalLine}>
          <span>В очереди: {total}</span>
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

      <section className={styles.filtersRow}>
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

        {hasAnyCustomFilters ? (
          <Button variant="ghost" onClick={resetFilters}>
            Сбросить фильтры
          </Button>
        ) : null}
      </section>

      {error ? (
        <div className={styles.error} role="status" aria-live="polite">
          {error}
        </div>
      ) : null}

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
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col">Ученик</th>
                <th scope="col" className={styles.columnCenter}>Задача</th>
                <th scope="col">Раздел</th>
                <th scope="col">Отправлено</th>
                <th scope="col" className={styles.columnCenter}>Статус</th>
                <th scope="col" className={styles.columnCenter}>Фото</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr
                  key={item.submissionId}
                  className={styles.tableRowClickable}
                  onClick={() => openSubmission(item.submissionId)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      openSubmission(item.submissionId);
                    }
                  }}
                  role="link"
                  tabIndex={0}
                  aria-label={`Открыть отправку ученика ${getStudentName(item.student)}`}
                >
                  <td className={styles.studentCell}>
                    <div className={styles.studentName}>{getStudentName(item.student)}</div>
                    <div className={styles.studentLogin}>@{item.student.login}</div>
                  </td>
                  <td className={styles.taskCell}>{getTaskDisplayLabel(item.task)}</td>
                  <td className={styles.pathCell}>
                    {item.course.title} / {item.section.title} / {item.unit.title}
                  </td>
                  <td>{formatDateTime(item.submittedAt)}</td>
                  <td className={styles.columnCenter}>
                    <span className={`${styles.status} ${styles[statusClassName[item.status]]}`}>
                      {getPhotoReviewStatusLabel(item.status)}
                    </span>
                  </td>
                  <td className={styles.columnCenter}>{item.assetKeysCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}
