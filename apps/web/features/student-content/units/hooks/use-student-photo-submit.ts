import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback, useRef, useState, type ChangeEvent } from "react";
import type { AppState, BinaryFiles, ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";
import type { ExcalidrawElement, NonDeletedExcalidrawElement } from "@excalidraw/excalidraw/element/types";
import {
  studentApi,
  type StudentPhotoFileInput,
  type Task,
  type TaskState,
} from "@/lib/api/student";
import { learningPhotoQueryKeys } from "@/lib/query/keys";

const PHOTO_MAX_FILES = 5;
const PHOTO_MAX_SIZE_BYTES = 20 * 1024 * 1024;
const PHOTO_ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const PHOTO_REVIEWABLE_STATUS = new Set<TaskState["status"]>(["not_started", "in_progress", "rejected"]);
const BOARD_JSON_CONTENT_TYPE = "application/json";
const BOARD_PREVIEW_CONTENT_TYPE = "image/png";

const formatBytes = (bytes: number) => {
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
  if (bytes >= 1024) {
    return `${Math.round(bytes / 1024)} KB`;
  }
  return `${bytes} B`;
};

type Params = {
  activeTask: Task | null;
  activeState: TaskState | null;
  unitId: string;
};

type PhotoAnswerMode = "photo" | "board";

const hasVisibleBoardElements = (elements: readonly ExcalidrawElement[]) =>
  elements.some((element) => !element.isDeleted);

const isVisibleBoardElement = (element: ExcalidrawElement): element is NonDeletedExcalidrawElement =>
  !element.isDeleted;

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
    throw new Error("Не удалось загрузить ответ.");
  }
};

export const useStudentPhotoSubmit = ({ activeTask, activeState, unitId }: Params) => {
  const queryClient = useQueryClient();
  const photoFileInputRef = useRef<HTMLInputElement | null>(null);
  const boardApiRef = useRef<ExcalidrawImperativeAPI | null>(null);
  const [photoSelectedFilesByTask, setPhotoSelectedFilesByTask] = useState<Record<string, File[]>>({});
  const [photoLoadingByTask, setPhotoLoadingByTask] = useState<Record<string, boolean>>({});
  const [photoFileDialogTaskId, setPhotoFileDialogTaskId] = useState<string | null>(null);
  const [photoAnswerModeByTask, setPhotoAnswerModeByTask] = useState<Record<string, PhotoAnswerMode>>({});
  const [boardHasElementsByTask, setBoardHasElementsByTask] = useState<Record<string, boolean>>({});

  const submitPhotoMutation = useMutation({
    mutationFn: async ({ taskId, files }: { taskId: string; files: File[] }) => {
      const presignFiles: StudentPhotoFileInput[] = files.map((file) => ({
        filename: file.name,
        contentType: file.type.toLowerCase() as StudentPhotoFileInput["contentType"],
        sizeBytes: file.size,
      }));
      const presigned = await studentApi.presignPhotoUpload(taskId, presignFiles);

      await Promise.all(
        presigned.uploads.map(async (upload, index) => {
          const file = files[index];
          if (!file) {
            throw new Error("Ошибка сопоставления файла и presigned URL.");
          }

          const headers = new Headers(upload.headers ?? {});
          if (!headers.has("Content-Type")) {
            headers.set("Content-Type", file.type);
          }

          const response = await fetch(upload.url, {
            method: "PUT",
            headers,
            body: file,
          });

          if (!response.ok) {
            throw new Error(`Не удалось загрузить файл ${file.name}.`);
          }
        }),
      );

      await studentApi.submitPhoto(
        taskId,
        presigned.uploads.map((item) => item.assetKey),
      );
    },
  });

  const submitBoardMutation = useMutation({
    mutationFn: async ({ taskId, api }: { taskId: string; api: ExcalidrawImperativeAPI }) => {
      const elements = api.getSceneElements();
      if (!hasVisibleBoardElements(elements)) {
        throw new Error("Доска пуста.");
      }

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

      const presigned = await studentApi.presignPhotoBoardUpload(taskId, {
        jsonSizeBytes: boardBlob.size,
        previewSizeBytes: previewBlob.size,
      });

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

      await studentApi.submitPhotoBoard(taskId, {
        boardAssetKey: presigned.board.assetKey,
        boardPreviewAssetKey: presigned.preview.assetKey,
      });
    },
  });

  const validatePhotoFiles = useCallback((files: File[]) => {
    if (files.length === 0) return "Выберите хотя бы один файл.";
    if (files.length > PHOTO_MAX_FILES) {
      return `Можно выбрать не более ${PHOTO_MAX_FILES} файлов.`;
    }

    for (const file of files) {
      if (!PHOTO_ALLOWED_TYPES.has(file.type.toLowerCase())) {
        return "Разрешены только JPEG, PNG и WEBP.";
      }
      if (file.size > PHOTO_MAX_SIZE_BYTES) {
        return `Файл ${file.name} превышает лимит ${formatBytes(PHOTO_MAX_SIZE_BYTES)}.`;
      }
    }

    return null;
  }, []);

  const openPhotoFileDialog = useCallback((taskId: string) => {
    setPhotoFileDialogTaskId(taskId);
    photoFileInputRef.current?.click();
  }, []);

  const handlePhotoFileSelection = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const taskId = photoFileDialogTaskId;
      if (!taskId) return;

      const files = Array.from(event.target.files ?? []);
      event.currentTarget.value = "";

      const validationError = validatePhotoFiles(files);
      if (validationError) {
        return;
      }

      setPhotoSelectedFilesByTask((prev) => ({ ...prev, [taskId]: files }));
    },
    [photoFileDialogTaskId, validatePhotoFiles],
  );

  const submitPhotoTask = useCallback(
    async (taskId: string, filesOverride?: File[]) => {
      const files = filesOverride ?? photoSelectedFilesByTask[taskId] ?? [];
      const validationError = validatePhotoFiles(files);
      if (validationError) {
        return;
      }

      setPhotoLoadingByTask((prev) => ({ ...prev, [taskId]: true }));
      try {
        await submitPhotoMutation.mutateAsync({ taskId, files });
        setPhotoSelectedFilesByTask((prev) => ({ ...prev, [taskId]: [] }));

        await queryClient.invalidateQueries({
          queryKey: learningPhotoQueryKeys.studentUnit(unitId),
          exact: true,
        });
      } catch {
      } finally {
        setPhotoLoadingByTask((prev) => ({ ...prev, [taskId]: false }));
      }
    },
    [photoSelectedFilesByTask, queryClient, submitPhotoMutation, unitId, validatePhotoFiles],
  );

  const setPhotoAnswerMode = useCallback((taskId: string, mode: PhotoAnswerMode) => {
    setPhotoAnswerModeByTask((prev) => ({ ...prev, [taskId]: mode }));
  }, []);

  const setBoardApi = useCallback((api: ExcalidrawImperativeAPI) => {
    boardApiRef.current = api;
  }, []);

  const handleBoardChange = useCallback(
    (taskId: string, elements: readonly ExcalidrawElement[]) => {
      const hasElements = hasVisibleBoardElements(elements);
      setBoardHasElementsByTask((prev) => {
        if (prev[taskId] === hasElements) return prev;
        return { ...prev, [taskId]: hasElements };
      });
    },
    [],
  );

  const submitBoardTask = useCallback(
    async (taskId: string) => {
      const api = boardApiRef.current;
      if (!api || !boardHasElementsByTask[taskId]) {
        return;
      }

      setPhotoLoadingByTask((prev) => ({ ...prev, [taskId]: true }));
      try {
        await submitBoardMutation.mutateAsync({ taskId, api });
        api.resetScene();
        setBoardHasElementsByTask((prev) => ({ ...prev, [taskId]: false }));

        await queryClient.invalidateQueries({
          queryKey: learningPhotoQueryKeys.studentUnit(unitId),
          exact: true,
        });
      } catch {
      } finally {
        setPhotoLoadingByTask((prev) => ({ ...prev, [taskId]: false }));
      }
    },
    [boardHasElementsByTask, queryClient, submitBoardMutation, unitId],
  );

  const activeTaskId = activeTask?.id ?? null;
  const isPhotoTask = activeTask?.answerType === "photo";
  const canUploadPhoto =
    Boolean(activeTask) &&
    isPhotoTask &&
    PHOTO_REVIEWABLE_STATUS.has((activeState?.status ?? "not_started") as TaskState["status"]);

  return {
    photoFileInputRef,
    handlePhotoFileSelection,
    canUploadPhoto,
    isPhotoLoading: activeTaskId ? Boolean(photoLoadingByTask[activeTaskId]) : false,
    photoSelectedFiles: activeTaskId ? (photoSelectedFilesByTask[activeTaskId] ?? []) : [],
    photoAnswerMode: activeTaskId ? (photoAnswerModeByTask[activeTaskId] ?? "photo") : "photo",
    boardHasElements: activeTaskId ? Boolean(boardHasElementsByTask[activeTaskId]) : false,
    setPhotoAnswerMode,
    setBoardApi,
    handleBoardChange,
    openPhotoFileDialog,
    submitPhotoTask,
    submitBoardTask,
  };
};
