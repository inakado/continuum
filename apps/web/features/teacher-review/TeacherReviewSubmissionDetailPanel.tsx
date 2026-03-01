"use client";

import { useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import LiteTex from "@/components/LiteTex";
import Button from "@/components/ui/Button";
import { teacherApi, type TeacherReviewSubmissionDetailResponse } from "@/lib/api/teacher";
import { learningPhotoQueryKeys } from "@/lib/query/keys";
import { getPhotoReviewStatusLabel } from "@/lib/status-labels";
import { formatApiErrorPayload } from "@/features/teacher-content/shared/api-errors";
import { buildReviewSearch, readReviewRouteFilters } from "./review-query";
import styles from "./teacher-review-submission-detail-panel.module.css";

type Props = {
  submissionId: string;
};

type ReviewSubmission = TeacherReviewSubmissionDetailResponse["submission"];

type ReviewNavigation = TeacherReviewSubmissionDetailResponse["navigation"];

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

const usePhotoPreviewState = (
  submission: ReviewSubmission | null,
  activeAssetIndex: number,
  queryClient: ReturnType<typeof useQueryClient>,
) => {
  const photoPreviewQueryConfigs = useMemo(() => {
    if (!submission) return [];
    const studentId = submission.student.id;
    const taskId = submission.task.id;
    return submission.assetKeys.map((assetKey) => ({
      queryKey: learningPhotoQueryKeys.teacherPhotoAssetPreview(studentId, taskId, assetKey),
      queryFn: async () => {
        const response = await teacherApi.presignStudentTaskPhotoView(
          studentId,
          taskId,
          assetKey,
          300,
        );
        return response.url;
      },
      retry: 1,
    }));
  }, [submission]);

  const photoPreviewQueries = useQueries({
    queries: photoPreviewQueryConfigs,
  });

  const photoPreviewUrlByAssetKey = useMemo(() => {
    if (!submission) return {};
    return submission.assetKeys.reduce<Record<string, string>>((acc, assetKey, index) => {
      const url = photoPreviewQueries[index]?.data;
      if (url) acc[assetKey] = url;
      return acc;
    }, {});
  }, [photoPreviewQueries, submission]);

  const photoPreviewErrorByAssetKey = useMemo(() => {
    if (!submission) return {};
    return submission.assetKeys.reduce<Record<string, true>>((acc, assetKey, index) => {
      if (photoPreviewQueries[index]?.isError) acc[assetKey] = true;
      return acc;
    }, {});
  }, [photoPreviewQueries, submission]);

  const retryActivePreview = useCallback(() => {
    if (!submission) return;
    const activeAssetKey = submission.assetKeys[activeAssetIndex];
    if (!activeAssetKey) return;
    void queryClient.invalidateQueries({
      queryKey: learningPhotoQueryKeys.teacherPhotoAssetPreview(
        submission.student.id,
        submission.task.id,
        activeAssetKey,
      ),
      exact: true,
    });
  }, [activeAssetIndex, queryClient, submission]);

  return {
    photoPreviewErrorByAssetKey,
    photoPreviewUrlByAssetKey,
    retryActivePreview,
  };
};

const useReviewSubmissionAction = ({
  actionBusy,
  detail,
  goToInbox,
  goToSubmission,
  queryClient,
  setActionBusy,
  setActionError,
}: {
  actionBusy: "accept" | "reject" | null;
  detail: TeacherReviewSubmissionDetailResponse | null;
  goToInbox: () => void;
  goToSubmission: (nextSubmissionId: string) => void;
  queryClient: ReturnType<typeof useQueryClient>;
  setActionBusy: (value: "accept" | "reject" | null) => void;
  setActionError: (value: string | null) => void;
}) => {
  const reviewActionMutation = useMutation({
    mutationFn: async (input: {
      action: "accept" | "reject";
      studentId: string;
      taskId: string;
      submissionId: string;
    }) => {
      if (input.action === "accept") {
        await teacherApi.acceptStudentTaskPhotoSubmission(
          input.studentId,
          input.taskId,
          input.submissionId,
        );
        return;
      }
      await teacherApi.rejectStudentTaskPhotoSubmission(
        input.studentId,
        input.taskId,
        input.submissionId,
      );
    },
  });

  return useCallback(
    async (action: "accept" | "reject") => {
      const submission = detail?.submission;
      if (!submission || actionBusy || submission.status !== "pending_review") return;
      setActionBusy(action);
      setActionError(null);

      const nextSubmissionId = detail.navigation.nextSubmissionId ?? detail.navigation.prevSubmissionId;
      try {
        await reviewActionMutation.mutateAsync({
          action,
          studentId: submission.student.id,
          taskId: submission.task.id,
          submissionId: submission.submissionId,
        });
        await queryClient.invalidateQueries({
          queryKey: ["learning-photo", "teacher", "review"],
        });

        if (nextSubmissionId) {
          goToSubmission(nextSubmissionId);
          return;
        }
        goToInbox();
      } catch (err) {
        setActionError(formatApiErrorPayload(err));
      } finally {
        setActionBusy(null);
      }
    },
    [actionBusy, detail, goToInbox, goToSubmission, queryClient, reviewActionMutation, setActionBusy, setActionError],
  );
};

const SubmissionViewer = ({
  activeAssetIndex,
  activeAssetLoadFailed,
  activeAssetUrl,
  assetKeys,
  onAssetSelect,
  onRetryActivePreview,
  photoPreviewUrlByAssetKey,
}: {
  activeAssetIndex: number;
  activeAssetLoadFailed: boolean;
  activeAssetUrl: string | null;
  assetKeys: string[];
  onAssetSelect: (index: number) => void;
  onRetryActivePreview: () => void;
  photoPreviewUrlByAssetKey: Record<string, string>;
}) => (
  <section className={styles.viewer}>
    <div className={styles.viewerTop}>
      <span className={styles.zoomBadge}>Масштаб 100%</span>
      {assetKeys.length > 1 ? (
        <span className={styles.assetCounter}>
          {activeAssetIndex + 1} / {assetKeys.length}
        </span>
      ) : null}
    </div>
    {activeAssetUrl ? (
      <a
        className={styles.viewerFrameLink}
        href={activeAssetUrl}
        target="_blank"
        rel="noreferrer"
        title="Открыть оригинал"
      >
        <Image
          src={activeAssetUrl}
          alt="Фото-ответ ученика"
          className={styles.viewerImage}
          fill
          sizes="(max-width: 1180px) 100vw, 60vw"
          unoptimized
        />
      </a>
    ) : (
      <div className={styles.viewerFrame}>
        {activeAssetLoadFailed ? (
          <div className={styles.viewerPlaceholderError}>
            <span>Не удалось загрузить превью.</span>
            <Button
              variant="ghost"
              className={styles.viewerRetryButton}
              onClick={() => onRetryActivePreview()}
            >
              Повторить
            </Button>
          </div>
        ) : (
          <div className={styles.viewerPlaceholder}>Превью загружается…</div>
        )}
      </div>
    )}

    {assetKeys.length > 1 ? (
      <div className={styles.thumbRail}>
        {assetKeys.map((assetKey, index) => (
          <button
            key={assetKey}
            type="button"
            className={`${styles.thumbButton} ${index === activeAssetIndex ? styles.thumbButtonActive : ""}`}
            onClick={() => onAssetSelect(index)}
            aria-label={`Открыть кадр ${index + 1}`}
          >
            {photoPreviewUrlByAssetKey[assetKey] ? (
              <Image
                src={photoPreviewUrlByAssetKey[assetKey]}
                alt={`Миниатюра фото ${index + 1}`}
                className={styles.thumbPreview}
                width={82}
                height={64}
                unoptimized
              />
            ) : (
              <span className={styles.thumbIndex}>{index + 1}</span>
            )}
          </button>
        ))}
      </div>
    ) : null}
  </section>
);

const SubmissionSidebar = ({
  actionBusy,
  navigation,
  onAccept,
  onGoToPrevious,
  onGoToProfile,
  onGoToNext,
  onReject,
  submission,
}: {
  actionBusy: "accept" | "reject" | null;
  navigation: ReviewNavigation | null;
  onAccept: () => void;
  onGoToPrevious: () => void;
  onGoToProfile: () => void;
  onGoToNext: () => void;
  onReject: () => void;
  submission: ReviewSubmission;
}) => (
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
          onClick={onAccept}
          disabled={submission.status !== "pending_review" || Boolean(actionBusy)}
        >
          {actionBusy === "accept" ? "Принятие…" : "Принять"}
        </Button>
        <Button
          variant="ghost"
          className={styles.rejectButton}
          onClick={onReject}
          disabled={submission.status !== "pending_review" || Boolean(actionBusy)}
        >
          {actionBusy === "reject" ? "Отклонение…" : "Отклонить"}
        </Button>
      </div>
    </section>

    <section className={styles.card}>
      <div className={styles.queueActions}>
        <Button variant="ghost" onClick={onGoToPrevious} disabled={!navigation?.prevSubmissionId}>
          Предыдущая
        </Button>
        <Button variant="ghost" onClick={onGoToNext} disabled={!navigation?.nextSubmissionId}>
          Следующая
        </Button>
      </div>
      <Button variant="ghost" className={styles.profileButton} onClick={onGoToProfile}>
        Профиль ученика
      </Button>
    </section>

    {submission.rejectedReason ? (
      <section className={styles.card}>
        <div className={styles.noteText}>{submission.rejectedReason}</div>
      </section>
    ) : null}
  </aside>
);

export default function TeacherReviewSubmissionDetailPanel({ submissionId }: Props) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const searchParamsKey = searchParams.toString();
  const filters = useMemo(
    () => readReviewRouteFilters(new URLSearchParams(searchParamsKey)),
    [searchParamsKey],
  );

  const detailQuery = useQuery<TeacherReviewSubmissionDetailResponse>({
    queryKey: learningPhotoQueryKeys.teacherReviewSubmissionDetail(submissionId, filters),
    queryFn: () => teacherApi.getTeacherPhotoSubmissionDetail(submissionId, filters),
  });
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionBusy, setActionBusy] = useState<"accept" | "reject" | null>(null);
  const [activeAssetIndex, setActiveAssetIndex] = useState(0);
  const detail = detailQuery.data ?? null;
  const loading = detailQuery.isPending;
  const error = actionError ?? (detailQuery.isError ? formatApiErrorPayload(detailQuery.error) : null);
  const submission = detail?.submission ?? null;

  useEffect(() => {
    setActionError(null);
    setActiveAssetIndex(0);
  }, [searchParamsKey, submissionId]);

  const {
    photoPreviewErrorByAssetKey,
    photoPreviewUrlByAssetKey,
    retryActivePreview,
  } = usePhotoPreviewState(submission, activeAssetIndex, queryClient);

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

  const handleAction = useReviewSubmissionAction({
    actionBusy,
    detail,
    goToInbox,
    goToSubmission,
    queryClient,
    setActionBusy,
    setActionError,
  });

  const navigation = detail?.navigation ?? null;
  const assetKeys = submission?.assetKeys ?? [];
  const activeAssetKey = assetKeys[activeAssetIndex] ?? null;
  const activeAssetUrl = activeAssetKey ? photoPreviewUrlByAssetKey[activeAssetKey] : null;
  const activeAssetLoadFailed = activeAssetKey ? Boolean(photoPreviewErrorByAssetKey[activeAssetKey]) : false;
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
          <SubmissionViewer
            activeAssetIndex={activeAssetIndex}
            activeAssetLoadFailed={activeAssetLoadFailed}
            activeAssetUrl={activeAssetUrl}
            assetKeys={assetKeys}
            onAssetSelect={setActiveAssetIndex}
            onRetryActivePreview={retryActivePreview}
            photoPreviewUrlByAssetKey={photoPreviewUrlByAssetKey}
          />
          <SubmissionSidebar
            actionBusy={actionBusy}
            navigation={navigation}
            onAccept={() => void handleAction("accept")}
            onGoToPrevious={() => navigation?.prevSubmissionId && goToSubmission(navigation.prevSubmissionId)}
            onGoToProfile={() =>
              router.push(
                `/teacher/students/${submission.student.id}${profileFocusSearch ? `?${profileFocusSearch}` : ""}`,
              )
            }
            onGoToNext={() => navigation?.nextSubmissionId && goToSubmission(navigation.nextSubmissionId)}
            onReject={() => void handleAction("reject")}
            submission={submission}
          />
        </div>
      ) : null}
    </section>
  );
}
