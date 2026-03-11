"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useCallback, useMemo } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import Button from "@/components/ui/Button";
import EmptyState from "@/components/ui/EmptyState";
import FieldLabel from "@/components/ui/FieldLabel";
import InlineStatus from "@/components/ui/InlineStatus";
import Kicker from "@/components/ui/Kicker";
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

const statusTone: Record<TeacherReviewSubmissionStatus, "warning" | "success" | "danger"> = {
  pending_review: "warning",
  accepted: "success",
  rejected: "danger",
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

type ReviewFilters = ReturnType<typeof readReviewRouteFilters>;

const DEFAULT_REVIEW_FILTERS: Pick<ReviewFilters, "status" | "sort"> = {
  status: "pending_review",
  sort: "oldest",
};

const buildInboxHref = (filters: Partial<ReviewFilters>) => {
  const search = buildReviewSearch(filters);
  return `/teacher/review${search ? `?${search}` : ""}`;
};

const buildSubmissionHref = (submissionId: string, filters: Partial<ReviewFilters>) => {
  const search = buildReviewSearch(filters);
  return `/teacher/review/${submissionId}${search ? `?${search}` : ""}`;
};

const hasCustomFilters = (filters: ReviewFilters) =>
  Boolean(
    filters.status !== DEFAULT_REVIEW_FILTERS.status ||
      filters.sort !== DEFAULT_REVIEW_FILTERS.sort ||
      filters.studentId ||
      filters.courseId ||
      filters.sectionId ||
      filters.unitId ||
      filters.taskId,
  );

type ReviewToolbarProps = {
  total: number;
  hasItems: boolean;
  onRefresh: () => void;
  onOpenFirst: () => void;
};

const ReviewToolbar = ({
  total,
  hasItems,
  onRefresh,
  onOpenFirst,
}: ReviewToolbarProps) => (
  <header className={styles.toolbar}>
    <Kicker className={styles.toolbarKicker}>В очереди: {total}</Kicker>
    <div className={styles.headerActions}>
      <Button variant="secondary" onClick={onRefresh}>
        Обновить
      </Button>
      <Button onClick={onOpenFirst} disabled={!hasItems}>
        Открыть первую на проверке
      </Button>
    </div>
  </header>
);

type ReviewFiltersRowProps = {
  filters: ReviewFilters;
  students: StudentSummary[];
  hasAnyCustomFilters: boolean;
  onStatusChange: (value: TeacherReviewSubmissionStatus) => void;
  onSortChange: (value: "oldest" | "newest") => void;
  onStudentChange: (value?: string) => void;
  onReset: () => void;
};

const ReviewFiltersRow = ({
  filters,
  students,
  hasAnyCustomFilters,
  onStatusChange,
  onSortChange,
  onStudentChange,
  onReset,
}: ReviewFiltersRowProps) => (
  <section className={styles.filtersCard}>
    <div className={styles.filtersRow}>
      <FieldLabel className={styles.filterField} label="Статус">
        <Select
          triggerClassName={styles.selectTrigger}
          value={filters.status}
          onValueChange={(value) => onStatusChange(value as TeacherReviewSubmissionStatus)}
          options={[
            { value: "pending_review", label: "На проверке", section: "В работе" },
            { value: "accepted", label: "Принято", section: "История" },
            { value: "rejected", label: "Отклонено", section: "История" },
          ]}
          placeholder="Статус"
        />
      </FieldLabel>

      <FieldLabel className={styles.filterField} label="Порядок">
        <Select
          triggerClassName={styles.selectTrigger}
          value={filters.sort}
          onValueChange={(value) => onSortChange(value as "oldest" | "newest")}
          options={[
            { value: "oldest", label: sortLabel.oldest },
            { value: "newest", label: sortLabel.newest },
          ]}
          placeholder="Порядок"
        />
      </FieldLabel>

      <FieldLabel className={styles.filterField} label="Ученик">
        <Select
          triggerClassName={styles.selectTrigger}
          value={filters.studentId ?? ""}
          onValueChange={(value) => onStudentChange(value || undefined)}
          options={[
            { value: "", label: "Все ученики" },
            ...students.map((student) => ({
              value: student.id,
              label: `${getStudentName(student)} (${student.login})`,
            })),
          ]}
          placeholder="Ученик"
        />
      </FieldLabel>
      {hasAnyCustomFilters ? (
        <div className={styles.filterActions}>
          <Button variant="secondary" size="sm" className={styles.resetFiltersButton} onClick={onReset}>
            Сбросить фильтры
          </Button>
        </div>
      ) : null}
    </div>
  </section>
);

const ReviewEmptyState = ({ onReset }: { onReset: () => void }) => (
  <EmptyState
    title="Нет задач на проверке"
    description="Измените фильтры или дождитесь новых фото-отправок."
    actions={
      <Button variant="secondary" onClick={onReset}>
        Сбросить фильтры
      </Button>
    }
  />
);

type ReviewTableProps = {
  items: TeacherReviewInboxItem[];
  getSubmissionHref: (submissionId: string) => string;
};

const ReviewTable = ({ items, getSubmissionHref }: ReviewTableProps) => (
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
              <InlineStatus tone={statusTone[item.status]} className={styles.status}>
                {getPhotoReviewStatusLabel(item.status)}
              </InlineStatus>
            </td>
            <td className={styles.columnCenter}>{item.assetKeysCount}</td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

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
  const hasAnyCustomFilters = hasCustomFilters(filters);

  const pushInbox = useCallback(
    (nextFilters: Partial<ReviewFilters>) => {
      router.push(buildInboxHref(nextFilters));
    },
    [router],
  );

  const updateFilters = useCallback(
    (patch: Partial<ReviewFilters>) => {
      pushInbox({
        ...filters,
        ...patch,
      });
    },
    [filters, pushInbox],
  );

  const openSubmission = useCallback(
    (submissionId: string) => {
      router.push(buildSubmissionHref(submissionId, filters));
    },
    [filters, router],
  );

  const resetFilters = useCallback(() => {
    pushInbox(DEFAULT_REVIEW_FILTERS);
  }, [pushInbox]);

  const getSubmissionHref = useCallback(
    (submissionId: string) => buildSubmissionHref(submissionId, filters),
    [filters],
  );

  return (
    <section className={styles.panel}>
      <ReviewToolbar
        total={total}
        hasItems={items.length > 0}
        onRefresh={() => void inboxQuery.refetch()}
        onOpenFirst={() => {
          const first = items[0];
          if (first) {
            openSubmission(first.submissionId);
          }
        }}
      />

      <ReviewFiltersRow
        filters={filters}
        students={students}
        hasAnyCustomFilters={hasAnyCustomFilters}
        onStatusChange={(status) => updateFilters({ status })}
        onSortChange={(sort) => updateFilters({ sort })}
        onStudentChange={(studentId) => updateFilters({ studentId })}
        onReset={resetFilters}
      />

      {error ? (
        <div className={styles.error} role="status" aria-live="polite">
          {error}
        </div>
      ) : null}

      {loading ? <div className={styles.loading}>Загрузка очереди…</div> : null}

      {!loading && !items.length ? <ReviewEmptyState onReset={resetFilters} /> : null}

      {!loading && items.length ? <ReviewTable items={items} getSubmissionHref={getSubmissionHref} /> : null}
    </section>
  );
}
