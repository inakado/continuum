"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import LiteTex from "@/components/LiteTex";
import Button from "@/components/ui/Button";
import { teacherApi, type TeacherReviewSubmissionDetailResponse } from "@/lib/api/teacher";
import { getPhotoReviewStatusLabel } from "@/lib/status-labels";
import { formatApiErrorPayload } from "@/features/teacher-content/shared/api-errors";
import { buildReviewSearch, readReviewRouteFilters } from "./review-query";
import styles from "./teacher-review-submission-detail-panel.module.css";

type Props = {
  submissionId: string;
};

const statusClassName = {
  pending_review: "statusPending",
  accepted: "statusAccepted",
  rejected: "statusRejected",
} as const;

const formatDateTime = (value: string) =>
  new Date(value).toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

const getStudentName = (student: { firstName: string | null; lastName: string | null; login: string }) => {
  const parts = [student.lastName, student.firstName].filter(Boolean);
  return parts.length ? parts.join(" ") : student.login;
};

export default function TeacherReviewSubmissionDetailPanel({ submissionId }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const filters = useMemo(() => readReviewRouteFilters(searchParams), [searchParams]);

  const [detail, setDetail] = useState<TeacherReviewSubmissionDetailResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionBusy, setActionBusy] = useState<"accept" | "reject" | null>(null);
  const [photoPreviewUrlByAssetKey, setPhotoPreviewUrlByAssetKey] = useState<Record<string, string>>({});
  const [activeAssetIndex, setActiveAssetIndex] = useState(0);

  const loadDetail = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await teacherApi.getTeacherPhotoSubmissionDetail(submissionId, filters);
      setDetail(response);
      setActiveAssetIndex(0);
    } catch (err) {
      setDetail(null);
      setError(formatApiErrorPayload(err));
    } finally {
      setLoading(false);
    }
  }, [filters, submissionId]);

  useEffect(() => {
    void loadDetail();
  }, [loadDetail]);

  useEffect(() => {
    let cancelled = false;

    const preload = async () => {
      const submission = detail?.submission;
      if (!submission) return;
      const missingAssetKeys = submission.assetKeys.filter((assetKey) => !photoPreviewUrlByAssetKey[assetKey]);
      if (!missingAssetKeys.length) return;

      await Promise.all(
        missingAssetKeys.map(async (assetKey) => {
          try {
            const response = await teacherApi.presignStudentTaskPhotoView(
              submission.student.id,
              submission.task.id,
              assetKey,
              300,
            );
            if (cancelled) return;
            setPhotoPreviewUrlByAssetKey((prev) => ({ ...prev, [assetKey]: response.url }));
          } catch {
            /* fallback: link button below */
          }
        }),
      );
    };

    void preload();

    return () => {
      cancelled = true;
    };
  }, [detail, photoPreviewUrlByAssetKey]);

  const queryString = useMemo(() => buildReviewSearch(filters), [filters]);

  const goToInbox = useCallback(() => {
    router.push(`/teacher/review${queryString ? `?${queryString}` : ""}`);
  }, [queryString, router]);

  const goToSubmission = useCallback(
    (nextSubmissionId: string) => {
      router.push(`/teacher/review/${nextSubmissionId}${queryString ? `?${queryString}` : ""}`);
    },
    [queryString, router],
  );

  const handleAction = useCallback(
    async (action: "accept" | "reject") => {
      const submission = detail?.submission;
      if (!submission || actionBusy || submission.status !== "pending_review") return;
      setActionBusy(action);
      setError(null);

      const nextSubmissionId = detail.navigation.nextSubmissionId ?? detail.navigation.prevSubmissionId;
      try {
        if (action === "accept") {
          await teacherApi.acceptStudentTaskPhotoSubmission(
            submission.student.id,
            submission.task.id,
            submission.submissionId,
          );
        } else {
          await teacherApi.rejectStudentTaskPhotoSubmission(
            submission.student.id,
            submission.task.id,
            submission.submissionId,
          );
        }

        if (nextSubmissionId) {
          goToSubmission(nextSubmissionId);
        } else {
          goToInbox();
        }
      } catch (err) {
        setError(formatApiErrorPayload(err));
      } finally {
        setActionBusy(null);
      }
    },
    [actionBusy, detail, goToInbox, goToSubmission],
  );

  const submission = detail?.submission ?? null;
  const navigation = detail?.navigation ?? null;
  const assetKeys = submission?.assetKeys ?? [];
  const activeAssetKey = assetKeys[activeAssetIndex] ?? null;
  const activeAssetUrl = activeAssetKey ? photoPreviewUrlByAssetKey[activeAssetKey] : null;
  const profileFocusSearch = submission
    ? new URLSearchParams({
        courseId: submission.course.id,
        sectionId: submission.section.id,
        unitId: submission.unit.id,
        taskId: submission.task.id,
      }).toString()
    : "";

  return (
    <section className={styles.panel}>
      <header className={styles.header}>
        <div>
          <p className={styles.kicker}>Submission Detail</p>
          <h2 className={styles.title}>Проверка фото-отправки</h2>
        </div>
        <div className={styles.headerActions}>
          <Button variant="ghost" onClick={goToInbox}>
            Назад к очереди
          </Button>
          <Button variant="ghost" onClick={loadDetail}>
            Повторить
          </Button>
        </div>
      </header>

      {error ? (
        <div className={styles.error} role="status" aria-live="polite">
          {error}
        </div>
      ) : null}

      {loading ? <div className={styles.loading}>Загрузка отправки…</div> : null}

      {!loading && !submission ? (
        <div className={styles.empty}>Не удалось открыть отправку. Проверьте доступ или фильтры.</div>
      ) : null}

      {!loading && submission ? (
        <div className={styles.content}>
          <section className={styles.viewer}>
            <div className={styles.viewerFrame}>
              {activeAssetUrl ? (
                <img
                  src={activeAssetUrl}
                  alt="Фото-ответ ученика"
                  className={styles.viewerImage}
                />
              ) : (
                <div className={styles.viewerPlaceholder}>Превью загружается…</div>
              )}
            </div>

            {activeAssetKey && activeAssetUrl ? (
              <a
                className={styles.openAssetLink}
                href={activeAssetUrl}
                target="_blank"
                rel="noreferrer"
              >
                Открыть оригинал
              </a>
            ) : null}

            {assetKeys.length > 1 ? (
              <div className={styles.thumbs}>
                {assetKeys.map((assetKey, index) => (
                  <button
                    key={assetKey}
                    type="button"
                    className={`${styles.thumbButton} ${index === activeAssetIndex ? styles.thumbButtonActive : ""}`}
                    onClick={() => setActiveAssetIndex(index)}
                  >
                    {index + 1}
                  </button>
                ))}
              </div>
            ) : null}
          </section>

          <aside className={styles.meta}>
            <div className={styles.metaBlock}>
              <div className={styles.metaTitle}>{getStudentName(submission.student)}</div>
              <div className={styles.metaSub}>@{submission.student.login}</div>
              <div className={styles.path}>
                <span>{submission.course.title}</span>
                <span>/</span>
                <span>{submission.section.title}</span>
                <span>/</span>
                <span>{submission.unit.title}</span>
              </div>
            </div>

            <div className={styles.metaRow}>
              <span className={`${styles.status} ${styles[statusClassName[submission.status]]}`}>
                {getPhotoReviewStatusLabel(submission.status)}
              </span>
              <span>Отправлено: {formatDateTime(submission.submittedAt)}</span>
              {submission.reviewedAt ? <span>Проверено: {formatDateTime(submission.reviewedAt)}</span> : null}
            </div>

            <div className={styles.taskBlock}>
              <div className={styles.taskTitle}>{submission.task.title ?? `Задача ${submission.task.id}`}</div>
              <div className={styles.taskStatement}>
                <LiteTex value={submission.task.statementLite} block />
              </div>
            </div>

            <div className={styles.actions}>
              <Button
                onClick={() => void handleAction("accept")}
                disabled={submission.status !== "pending_review" || Boolean(actionBusy)}
              >
                {actionBusy === "accept" ? "Принятие…" : "Принять"}
              </Button>
              <Button
                variant="ghost"
                onClick={() => void handleAction("reject")}
                disabled={submission.status !== "pending_review" || Boolean(actionBusy)}
              >
                {actionBusy === "reject" ? "Отклонение…" : "Отклонить"}
              </Button>
            </div>

            <div className={styles.navRow}>
              <Button
                variant="ghost"
                onClick={() => navigation?.prevSubmissionId && goToSubmission(navigation.prevSubmissionId)}
                disabled={!navigation?.prevSubmissionId}
              >
                Предыдущая
              </Button>
              <Button
                variant="ghost"
                onClick={() => navigation?.nextSubmissionId && goToSubmission(navigation.nextSubmissionId)}
                disabled={!navigation?.nextSubmissionId}
              >
                Следующая
              </Button>
            </div>

            <div className={styles.links}>
              <Button
                variant="ghost"
                onClick={() =>
                  router.push(
                    `/teacher/students/${submission.student.id}${profileFocusSearch ? `?${profileFocusSearch}` : ""}`,
                  )
                }
              >
                Открыть в профиле ученика
              </Button>
              <Button
                variant="ghost"
                onClick={() =>
                  router.push(
                    `/teacher/students/${submission.student.id}?courseId=${submission.course.id}&sectionId=${submission.section.id}&unitId=${submission.unit.id}`,
                  )
                }
              >
                Открыть юнит (preview)
              </Button>
            </div>
          </aside>
        </div>
      ) : null}
    </section>
  );
}
