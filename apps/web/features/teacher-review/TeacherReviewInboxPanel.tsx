"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useCallback, useMemo } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import Button from "@/components/ui/Button";
import Select from "@/components/ui/Select";
import {
  teacherApi,
  type StudentSummary,
  type TeacherReviewInboxItem,
  type TeacherReviewSubmissionStatus,
} from "@/lib/api/teacher";
import { learningPhotoQueryKeys } from "@/lib/query/keys";
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
  const searchParamsKey = searchParams.toString();
  const filters = useMemo(
    () => readReviewRouteFilters(new URLSearchParams(searchParamsKey)),
    [searchParamsKey],
  );
  const inboxParams = useMemo(
    () => ({
      ...filters,
      limit: 50,
      offset: 0,
    }),
    [filters],
  );
  const inboxQuery = useQuery({
    queryKey: learningPhotoQueryKeys.teacherReviewInbox(inboxParams),
    queryFn: () => teacherApi.listTeacherPhotoInbox(inboxParams),
    placeholderData: keepPreviousData,
  });
  const studentsQuery = useQuery<StudentSummary[]>({
    queryKey: ["learning-photo", "teacher", "students", "list"],
    queryFn: () => teacherApi.listStudents(),
  });
  const items: TeacherReviewInboxItem[] = inboxQuery.data?.items ?? [];
  const total = inboxQuery.data?.total ?? 0;
  const loading = inboxQuery.isPending;
  const error = inboxQuery.isError ? formatApiErrorPayload(inboxQuery.error) : null;
  const students = studentsQuery.data ?? [];

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

  const getSubmissionHref = useCallback(
    (submissionId: string) => {
      const search = buildReviewSearch(filters);
      return `/teacher/review/${submissionId}${search ? `?${search}` : ""}`;
    },
    [filters],
  );

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
          <Button variant="ghost" onClick={() => void inboxQuery.refetch()}>
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
          <Select
            triggerClassName={styles.selectTrigger}
            value={filters.status}
            onValueChange={(value) => updateFilters({ status: value as TeacherReviewSubmissionStatus })}
            options={[
              { value: "pending_review", label: "На проверке", section: "В работе" },
              { value: "accepted", label: "Принято", section: "История" },
              { value: "rejected", label: "Отклонено", section: "История" },
            ]}
            placeholder="Статус"
          />
        </label>

        <label className={styles.filterField}>
          Порядок
          <Select
            triggerClassName={styles.selectTrigger}
            value={filters.sort}
            onValueChange={(value) => updateFilters({ sort: value as "oldest" | "newest" })}
            options={[
              { value: "oldest", label: sortLabel.oldest },
              { value: "newest", label: sortLabel.newest },
            ]}
            placeholder="Порядок"
          />
        </label>

        <label className={styles.filterField}>
          Ученик
          <Select
            triggerClassName={styles.selectTrigger}
            value={filters.studentId ?? ""}
            onValueChange={(value) => {
              updateFilters({
                studentId: value || undefined,
              });
            }}
            options={[
              { value: "", label: "Все ученики" },
              ...students.map((student) => ({
                value: student.id,
                label: `${getStudentName(student)} (${student.login})`,
              })),
            ]}
            placeholder="Ученик"
          />
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
                <tr key={item.submissionId}>
                  <td className={styles.studentCell}>
                    <Link
                      href={getSubmissionHref(item.submissionId)}
                      className={styles.rowLink}
                      aria-label={`Открыть отправку ученика ${getStudentName(item.student)}`}
                    >
                      <div className={styles.studentName}>{getStudentName(item.student)}</div>
                      <div className={styles.studentLogin}>@{item.student.login}</div>
                    </Link>
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
