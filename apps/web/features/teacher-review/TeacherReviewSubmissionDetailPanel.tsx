"use client";

import { useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { Suspense, useCallback, useMemo, useRef, useState } from "react";
import Image from "next/image";
import dynamic from "next/dynamic";
import { useRouter, useSearchParams } from "next/navigation";
import type { AppState, BinaryFiles, ExcalidrawImperativeAPI, ExcalidrawInitialDataState } from "@excalidraw/excalidraw/types";
import type { ExcalidrawElement, NonDeletedExcalidrawElement } from "@excalidraw/excalidraw/element/types";
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
type TeacherFeedbackBoardKeys = {
  teacherFeedbackBoardAssetKey: string;
  teacherFeedbackPreviewAssetKey: string;
};

const TeacherExcalidrawReviewBoard = dynamic(
  () =>
    import("./components/TeacherExcalidrawReviewBoard").then((mod) => mod.TeacherExcalidrawReviewBoard),
  {
    ssr: false,
    loading: () => <div className={styles.viewerPlaceholder}>Доска загружается…</div>,
  },
);

const BOARD_JSON_CONTENT_TYPE = "application/json";
const BOARD_PREVIEW_CONTENT_TYPE = "image/png";

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

const isVisibleBoardElement = (element: ExcalidrawElement): element is NonDeletedExcalidrawElement =>
  !element.isDeleted;

const getSubmissionDisplayAssetKeys = (submission: ReviewSubmission) => {
  return submission.answerKind === "photo" ? submission.assetKeys : [];
};

const usePhotoPreviewState = (
  submission: ReviewSubmission | null,
  displayAssetKeys: string[],
  activeAssetIndex: number,
  queryClient: ReturnType<typeof useQueryClient>,
) => {
  const photoPreviewQueryConfigs = useMemo(() => {
    if (!submission) return [];
    const studentId = submission.student.id;
    const taskId = submission.task.id;
    return displayAssetKeys.map((assetKey) => ({
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
  }, [displayAssetKeys, submission]);

  const photoPreviewQueries = useQueries({
    queries: photoPreviewQueryConfigs,
  });

  const photoPreviewUrlByAssetKey = useMemo(() => {
    if (!submission) return {};
    return displayAssetKeys.reduce<Record<string, string>>((acc, assetKey, index) => {
      const url = photoPreviewQueries[index]?.data;
      if (url) acc[assetKey] = url;
      return acc;
    }, {});
  }, [displayAssetKeys, photoPreviewQueries, submission]);

  const photoPreviewErrorByAssetKey = useMemo(() => {
    if (!submission) return {};
    return displayAssetKeys.reduce<Record<string, true>>((acc, assetKey, index) => {
      if (photoPreviewQueries[index]?.isError) acc[assetKey] = true;
      return acc;
    }, {});
  }, [displayAssetKeys, photoPreviewQueries, submission]);

  const retryActivePreview = useCallback(() => {
    if (!submission) return;
    const activeAssetKey = displayAssetKeys[activeAssetIndex];
    if (!activeAssetKey) return;
    void queryClient.invalidateQueries({
      queryKey: learningPhotoQueryKeys.teacherPhotoAssetPreview(
        submission.student.id,
        submission.task.id,
        activeAssetKey,
      ),
      exact: true,
    });
  }, [activeAssetIndex, displayAssetKeys, queryClient, submission]);

  return {
    photoPreviewErrorByAssetKey,
    photoPreviewUrlByAssetKey,
    retryActivePreview,
  };
};

const useReviewSubmissionAction = ({
  actionBusy,
  createFeedbackBoard,
  detail,
  goToInbox,
  goToSubmission,
  queryClient,
  setActionBusy,
  setActionError,
}: {
  actionBusy: "accept" | "reject" | null;
  createFeedbackBoard: (submission: ReviewSubmission) => Promise<TeacherFeedbackBoardKeys | null>;
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
      feedbackBoardKeys: TeacherFeedbackBoardKeys | null;
      studentId: string;
      taskId: string;
      submissionId: string;
    }) => {
      const reviewBody = input.feedbackBoardKeys
        ? {
            teacherFeedbackBoardAssetKey: input.feedbackBoardKeys.teacherFeedbackBoardAssetKey,
            teacherFeedbackPreviewAssetKey: input.feedbackBoardKeys.teacherFeedbackPreviewAssetKey,
          }
        : {};
      if (input.action === "accept") {
        await teacherApi.acceptStudentTaskPhotoSubmission(
          input.studentId,
          input.taskId,
          input.submissionId,
          reviewBody,
        );
        return;
      }
      await teacherApi.rejectStudentTaskPhotoSubmission(
        input.studentId,
        input.taskId,
        input.submissionId,
        reviewBody,
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
        const feedbackBoardKeys = await createFeedbackBoard(submission);
        await reviewActionMutation.mutateAsync({
          action,
          feedbackBoardKeys,
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
    [
      actionBusy,
      createFeedbackBoard,
      detail,
      goToInbox,
      goToSubmission,
      queryClient,
      reviewActionMutation,
      setActionBusy,
      setActionError,
    ],
  );
};

const putPresignedObject = async ({
  body,
  contentType,
  headers,
  url,
}: {
  body: Blob;
  contentType: string;
  headers?: Record<string, string>;
  url: string;
}) => {
  const requestHeaders = new Headers(headers ?? {});
  if (!requestHeaders.has("Content-Type")) {
    requestHeaders.set("Content-Type", contentType);
  }

  const response = await fetch(url, {
    method: "PUT",
    headers: requestHeaders,
    body,
  });

  if (!response.ok) {
    throw new Error("Не удалось загрузить доску разбора.");
  }
};

const parseExcalidrawScene = (value: unknown): ExcalidrawInitialDataState => {
  if (!value || typeof value !== "object") {
    throw new Error("Некорректный формат доски.");
  }
  const data = value as ExcalidrawInitialDataState;
  return {
    elements: data.elements ?? [],
    appState: {
      viewBackgroundColor: "#ffffff",
      ...data.appState,
    },
    files: data.files ?? {},
  };
};

const fetchBoardScene = async (url: string) => {
  const response = await fetch(url, { credentials: "omit" });
  if (!response.ok) {
    throw new Error("Не удалось загрузить доску ученика.");
  }
  return parseExcalidrawScene(await response.json());
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
        {assetKeys.length === 0 ? (
          <div className={styles.viewerPlaceholderError}>Нет превью для этой отправки.</div>
        ) : activeAssetLoadFailed ? (
          <div className={styles.viewerPlaceholderError}>
            <span>Не удалось загрузить превью.</span>
            <Button
              variant="secondary"
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

const BoardSubmissionViewer = ({
  boardLoadError,
  boardLoading,
  boardScene,
  onBoardChange,
  onBoardReady,
  onRetry,
  onUserInteraction,
  viewModeEnabled,
}: {
  boardLoadError: boolean;
  boardLoading: boolean;
  boardScene: ExcalidrawInitialDataState | null;
  onBoardChange: (elements: readonly ExcalidrawElement[]) => void;
  onBoardReady: (api: ExcalidrawImperativeAPI) => void;
  onRetry: () => void;
  onUserInteraction: () => void;
  viewModeEnabled: boolean;
}) => (
  <section className={styles.viewer}>
    <div className={styles.viewerTop}>
      <span className={styles.zoomBadge}>Доска</span>
    </div>
    <div className={styles.boardReviewFrame}>
      {boardScene ? (
        <TeacherExcalidrawReviewBoard
          initialData={boardScene}
          onChange={onBoardChange}
          onReady={onBoardReady}
          onUserInteraction={onUserInteraction}
          viewModeEnabled={viewModeEnabled}
        />
      ) : boardLoadError ? (
        <div className={styles.viewerPlaceholderError}>
          <span>Не удалось открыть доску ученика.</span>
          <Button variant="secondary" className={styles.viewerRetryButton} onClick={onRetry}>
            Повторить
          </Button>
        </div>
      ) : (
        <div className={styles.viewerPlaceholder}>{boardLoading ? "Доска загружается…" : "Доска недоступна."}</div>
      )}
    </div>
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
          variant="primary"
          onClick={onAccept}
          disabled={submission.status !== "pending_review" || Boolean(actionBusy)}
        >
          {actionBusy === "accept" ? "Принятие…" : "Принять"}
        </Button>
        <Button
          variant="danger"
          onClick={onReject}
          disabled={submission.status !== "pending_review" || Boolean(actionBusy)}
        >
          {actionBusy === "reject" ? "Отклонение…" : "Отклонить"}
        </Button>
      </div>
    </section>

    <section className={styles.card}>
      <div className={styles.queueActions}>
        <Button variant="secondary" onClick={onGoToPrevious} disabled={!navigation?.prevSubmissionId}>
          Предыдущая
        </Button>
        <Button variant="secondary" onClick={onGoToNext} disabled={!navigation?.nextSubmissionId}>
          Следующая
        </Button>
      </div>
      <Button variant="secondary" className={styles.profileButton} onClick={onGoToProfile}>
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

function TeacherReviewSubmissionDetailPanelRouteBoundary({ submissionId }: Props) {
  const searchParams = useSearchParams();
  const searchParamsKey = searchParams.toString();

  return (
    <TeacherReviewSubmissionDetailPanelContent
      key={`${submissionId}:${searchParamsKey}`}
      submissionId={submissionId}
      searchParamsKey={searchParamsKey}
    />
  );
}

function TeacherReviewSubmissionDetailPanelContent({
  submissionId,
  searchParamsKey,
}: Props & { searchParamsKey: string }) {
  const router = useRouter();
  const queryClient = useQueryClient();
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
  const [boardInteractionDirty, setBoardInteractionDirty] = useState(false);
  const boardApiRef = useRef<ExcalidrawImperativeAPI | null>(null);
  const detail = detailQuery.data ?? null;
  const loading = detailQuery.isPending;
  const error = actionError ?? (detailQuery.isError ? formatApiErrorPayload(detailQuery.error) : null);
  const submission = detail?.submission ?? null;
  const assetKeys = useMemo(() => (submission ? getSubmissionDisplayAssetKeys(submission) : []), [submission]);
  const boardAssetKey = submission?.answerKind === "board" ? (submission.boardAssetKey ?? null) : null;

  const boardSceneQuery = useQuery({
    queryKey: [
      "learning-photo",
      "teacher",
      "review",
      "board-scene",
      submission?.submissionId ?? null,
      boardAssetKey,
    ],
    enabled: Boolean(submission && boardAssetKey),
    queryFn: async () => {
      if (!submission || !boardAssetKey) {
        throw new Error("Доска недоступна.");
      }
      const response = await teacherApi.presignStudentTaskPhotoView(
        submission.student.id,
        submission.task.id,
        boardAssetKey,
        300,
      );
      return fetchBoardScene(response.url);
    },
    retry: 1,
  });

  const {
    photoPreviewErrorByAssetKey,
    photoPreviewUrlByAssetKey,
    retryActivePreview,
  } = usePhotoPreviewState(submission, assetKeys, activeAssetIndex, queryClient);

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

  const handleBoardReady = useCallback((api: ExcalidrawImperativeAPI) => {
    boardApiRef.current = api;
  }, []);

  const handleBoardChange = useCallback((_elements: readonly ExcalidrawElement[]) => {
    // The board API owns scene state; review submit exports from the API.
  }, []);

  const handleBoardUserInteraction = useCallback(() => {
    if (submission?.status === "pending_review") {
      setBoardInteractionDirty(true);
    }
  }, [submission?.status]);

  const createFeedbackBoard = useCallback(
    async (reviewSubmission: ReviewSubmission): Promise<TeacherFeedbackBoardKeys | null> => {
      const api = boardApiRef.current;
      if (reviewSubmission.answerKind !== "board" || !boardInteractionDirty || !api) return null;

      const elements = api.getSceneElements();
      const appState = api.getAppState();
      const files = api.getFiles();
      const [{ serializeAsJSON, exportToBlob }] = await Promise.all([
        import("@excalidraw/excalidraw"),
        document.fonts?.ready ?? Promise.resolve(),
      ]);

      const boardJson = serializeAsJSON(
        elements,
        {
          viewBackgroundColor: appState.viewBackgroundColor,
        } satisfies Partial<AppState>,
        files as BinaryFiles,
        "database",
      );
      const boardBlob = new Blob([boardJson], { type: BOARD_JSON_CONTENT_TYPE });
      const previewBlob = await exportToBlob({
        elements: elements.filter(isVisibleBoardElement),
        appState: {
          exportBackground: true,
          viewBackgroundColor: appState.viewBackgroundColor,
        },
        files,
        mimeType: BOARD_PREVIEW_CONTENT_TYPE,
        exportPadding: 16,
        maxWidthOrHeight: 2400,
      });

      const presigned = await teacherApi.presignTeacherFeedbackBoardUpload(
        reviewSubmission.student.id,
        reviewSubmission.task.id,
        reviewSubmission.submissionId,
        {
          jsonSizeBytes: boardBlob.size,
          previewSizeBytes: previewBlob.size,
        },
      );

      await Promise.all([
        putPresignedObject({
          body: boardBlob,
          contentType: presigned.board.contentType,
          headers: presigned.board.headers,
          url: presigned.board.url,
        }),
        putPresignedObject({
          body: previewBlob,
          contentType: presigned.preview.contentType,
          headers: presigned.preview.headers,
          url: presigned.preview.url,
        }),
      ]);

      return {
        teacherFeedbackBoardAssetKey: presigned.board.assetKey,
        teacherFeedbackPreviewAssetKey: presigned.preview.assetKey,
      };
    },
    [boardInteractionDirty],
  );

  const handleAction = useReviewSubmissionAction({
    actionBusy,
    createFeedbackBoard,
    detail,
    goToInbox,
    goToSubmission,
    queryClient,
    setActionBusy,
    setActionError,
  });

  const navigation = detail?.navigation ?? null;
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
          <Button variant="secondary" onClick={goToInbox}>
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
          {submission.answerKind === "board" ? (
            <BoardSubmissionViewer
              boardLoadError={boardSceneQuery.isError}
              boardLoading={boardSceneQuery.isPending}
              boardScene={boardSceneQuery.data ?? null}
              onBoardChange={handleBoardChange}
              onBoardReady={handleBoardReady}
              onRetry={() => void boardSceneQuery.refetch()}
              onUserInteraction={handleBoardUserInteraction}
              viewModeEnabled={submission.status !== "pending_review"}
            />
          ) : (
            <SubmissionViewer
              activeAssetIndex={activeAssetIndex}
              activeAssetLoadFailed={activeAssetLoadFailed}
              activeAssetUrl={activeAssetUrl}
              assetKeys={assetKeys}
              onAssetSelect={setActiveAssetIndex}
              onRetryActivePreview={retryActivePreview}
              photoPreviewUrlByAssetKey={photoPreviewUrlByAssetKey}
            />
          )}
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

export default function TeacherReviewSubmissionDetailPanel({ submissionId }: Props) {
  return (
    <Suspense
      fallback={
        <section className={styles.panel}>
          <div className={styles.loading}>Загрузка отправки…</div>
        </section>
      }
    >
      <TeacherReviewSubmissionDetailPanelRouteBoundary submissionId={submissionId} />
    </Suspense>
  );
}
