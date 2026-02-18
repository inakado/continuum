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

const getTaskNumberLabel = (task: { sortOrder: number }) => `№ ${task.sortOrder + 1}`;

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
      <header className={styles.toolbar}>
        <div className={styles.headerActions}>
          <Button variant="ghost" onClick={goToInbox}>
            Назад к очереди
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
            {activeAssetUrl ? (
              <a
                className={styles.viewerFrameLink}
                href={activeAssetUrl}
                target="_blank"
                rel="noreferrer"
                title="Открыть оригинал"
              >
                <img src={activeAssetUrl} alt="Фото-ответ ученика" className={styles.viewerImage} />
              </a>
            ) : (
              <div className={styles.viewerFrame}>
                <div className={styles.viewerPlaceholder}>Превью загружается…</div>
              </div>
            )}

            {assetKeys.length > 1 ? (
              <div className={styles.thumbRail}>
                {assetKeys.map((assetKey, index) => (
                  <button
                    key={assetKey}
                    type="button"
                    className={`${styles.thumbButton} ${index === activeAssetIndex ? styles.thumbButtonActive : ""}`}
                    onClick={() => setActiveAssetIndex(index)}
                    aria-label={`Открыть кадр ${index + 1}`}
                  >
                    {photoPreviewUrlByAssetKey[assetKey] ? (
                      <img
                        src={photoPreviewUrlByAssetKey[assetKey]}
                        alt={`Миниатюра фото ${index + 1}`}
                        className={styles.thumbPreview}
                      />
                    ) : (
                      <span className={styles.thumbIndex}>{index + 1}</span>
                    )}
                  </button>
                ))}
              </div>
            ) : null}
          </section>

          <aside className={styles.side}>
            <section className={styles.card}>
              <div className={styles.studentLine}>
                <div className={styles.studentName}>{getStudentName(submission.student)}</div>
                <div className={styles.studentLogin}>@{submission.student.login}</div>
              </div>
              <div className={styles.pathLine}>
                {submission.course.title} / {submission.section.title} / {submission.unit.title}
              </div>
              <div className={styles.metaGrid}>
                <div className={styles.metaItem}>
                  <span className={styles.metaLabel}>Статус</span>
                  <span className={`${styles.status} ${styles[statusClassName[submission.status]]}`}>
                    {getPhotoReviewStatusLabel(submission.status)}
                  </span>
                </div>
                <div className={styles.metaItem}>
                  <span className={styles.metaLabel}>Отправлено</span>
                  <span className={styles.metaValue}>{formatDateTime(submission.submittedAt)}</span>
                </div>
                {submission.reviewedAt ? (
                  <div className={styles.metaItem}>
                    <span className={styles.metaLabel}>Проверено</span>
                    <span className={styles.metaValue}>{formatDateTime(submission.reviewedAt)}</span>
                  </div>
                ) : null}
              </div>
            </section>

            <section className={styles.card}>
              <div className={styles.taskHead}>
                <span className={styles.taskNumber}>{getTaskNumberLabel(submission.task)}</span>
                {submission.task.title ? <span className={styles.taskTitle}>{submission.task.title}</span> : null}
              </div>
              <div className={styles.taskStatement}>
                <LiteTex value={submission.task.statementLite} block />
              </div>
            </section>

            <section className={styles.card}>
              <div className={styles.reviewActions}>
                <Button
                  className={styles.acceptButton}
                  onClick={() => void handleAction("accept")}
                  disabled={submission.status !== "pending_review" || Boolean(actionBusy)}
                >
                  {actionBusy === "accept" ? "Принятие…" : "Принять"}
                </Button>
                <Button
                  variant="ghost"
                  className={styles.rejectButton}
                  onClick={() => void handleAction("reject")}
                  disabled={submission.status !== "pending_review" || Boolean(actionBusy)}
                >
                  {actionBusy === "reject" ? "Отклонение…" : "Отклонить"}
                </Button>
              </div>
            </section>

            <section className={styles.card}>
              <div className={styles.queueActions}>
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
              <Button
                variant="ghost"
                className={styles.profileButton}
                onClick={() =>
                  router.push(
                    `/teacher/students/${submission.student.id}${profileFocusSearch ? `?${profileFocusSearch}` : ""}`,
                  )
                }
              >
                Профиль ученика
              </Button>
            </section>

            {submission.rejectedReason ? (
              <section className={styles.card}>
                <div className={styles.noteText}>{submission.rejectedReason}</div>
              </section>
            ) : null}
          </aside>
        </div>
      ) : null}
    </section>
  );
}
