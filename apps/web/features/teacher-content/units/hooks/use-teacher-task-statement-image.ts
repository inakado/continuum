import { useCallback, useEffect, useRef, useState, type ChangeEvent } from "react";
import { teacherApi, type Task } from "@/lib/api/teacher";
import { getApiErrorMessage } from "../../shared/api-errors";

const STATEMENT_IMAGE_MAX_SIZE_BYTES = 20 * 1024 * 1024;
const STATEMENT_IMAGE_ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export type TaskStatementImageState = {
  loading: boolean;
  error: string | null;
  updatedAt: number | null;
  key: string | null;
  previewUrl: string | null;
};

const createInitialTaskStatementImageState = (task?: Task | null): TaskStatementImageState => ({
  loading: false,
  error: null,
  updatedAt: null,
  key: task?.statementImageAssetKey ?? null,
  previewUrl: null,
});

const buildPdfPreviewSrc = (url: string): string => url;

type Params = {
  editingTask: Task | null;
  fetchUnit: () => Promise<unknown>;
};

export const useTeacherTaskStatementImage = ({ editingTask, fetchUnit }: Params) => {
  const taskStatementImageInputRef = useRef<HTMLInputElement | null>(null);
  const [taskStatementImageState, setTaskStatementImageState] = useState<TaskStatementImageState>(
    createInitialTaskStatementImageState(),
  );

  const refreshTaskStatementImagePreviewUrl = useCallback(async () => {
    if (!editingTask?.id) return null;
    const response = await teacherApi.presignTaskStatementImageView(editingTask.id, 600);
    const nextUrl = buildPdfPreviewSrc(response.url);
    setTaskStatementImageState((prev) => ({
      ...prev,
      key: response.key,
      previewUrl: nextUrl,
      error: null,
    }));
    return nextUrl;
  }, [editingTask?.id]);

  useEffect(() => {
    if (!editingTask) {
      setTaskStatementImageState(createInitialTaskStatementImageState());
      return;
    }

    let cancelled = false;
    setTaskStatementImageState(createInitialTaskStatementImageState(editingTask));
    if (!editingTask.statementImageAssetKey) return;

    void (async () => {
      try {
        const response = await teacherApi.presignTaskStatementImageView(editingTask.id, 600);
        if (cancelled) return;
        setTaskStatementImageState((prev) => ({
          ...prev,
          key: response.key,
          previewUrl: buildPdfPreviewSrc(response.url),
        }));
      } catch {
        if (cancelled) return;
        setTaskStatementImageState((prev) => ({
          ...prev,
          previewUrl: null,
        }));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [editingTask?.id, editingTask?.statementImageAssetKey]);

  const handleTaskStatementImageSelected = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0] ?? null;
      event.currentTarget.value = "";
      if (!editingTask || !file) return;

      if (!STATEMENT_IMAGE_ALLOWED_TYPES.has(file.type.toLowerCase())) {
        setTaskStatementImageState((prev) => ({
          ...prev,
          error: "Разрешены только JPEG, PNG и WEBP.",
        }));
        return;
      }
      if (file.size > STATEMENT_IMAGE_MAX_SIZE_BYTES) {
        setTaskStatementImageState((prev) => ({
          ...prev,
          error: `Максимальный размер файла: ${Math.round(
            STATEMENT_IMAGE_MAX_SIZE_BYTES / (1024 * 1024),
          )} MB.`,
        }));
        return;
      }

      setTaskStatementImageState((prev) => ({
        ...prev,
        loading: true,
        error: null,
      }));

      try {
        const presigned = await teacherApi.presignTaskStatementImageUpload(editingTask.id, {
          filename: file.name,
          contentType: file.type,
          sizeBytes: file.size,
        });
        const headers = new Headers(presigned.headers ?? {});
        if (!headers.has("Content-Type")) {
          headers.set("Content-Type", file.type);
        }

        const uploadResponse = await fetch(presigned.uploadUrl, {
          method: "PUT",
          headers,
          body: file,
        });

        if (!uploadResponse.ok) {
          throw new Error(`Не удалось загрузить файл (${uploadResponse.status}).`);
        }

        await teacherApi.applyTaskStatementImage(editingTask.id, presigned.assetKey);
        const view = await teacherApi.presignTaskStatementImageView(editingTask.id, 600);

        setTaskStatementImageState((prev) => ({
          ...prev,
          loading: false,
          error: null,
          updatedAt: Date.now(),
          key: view.key,
          previewUrl: buildPdfPreviewSrc(view.url),
        }));

        await fetchUnit();
      } catch (err) {
        setTaskStatementImageState((prev) => ({
          ...prev,
          loading: false,
          error: getApiErrorMessage(err),
        }));
      }
    },
    [editingTask, fetchUnit],
  );

  const handleTaskStatementImageRemove = useCallback(async () => {
    if (!editingTask) return;

    setTaskStatementImageState((prev) => ({
      ...prev,
      loading: true,
      error: null,
    }));

    try {
      await teacherApi.deleteTaskStatementImage(editingTask.id);
      setTaskStatementImageState((prev) => ({
        ...prev,
        loading: false,
        error: null,
        updatedAt: Date.now(),
        key: null,
        previewUrl: null,
      }));
      await fetchUnit();
    } catch (err) {
      setTaskStatementImageState((prev) => ({
        ...prev,
        loading: false,
        error: getApiErrorMessage(err),
      }));
    }
  }, [editingTask, fetchUnit]);

  const handleTaskStatementImagePreviewError = useCallback(() => {
    void refreshTaskStatementImagePreviewUrl().catch((err) => {
      setTaskStatementImageState((prev) => ({
        ...prev,
        error: getApiErrorMessage(err),
      }));
    });
  }, [refreshTaskStatementImagePreviewUrl]);

  const taskStatementImageStatusText = taskStatementImageState.loading
    ? "Загрузка изображения…"
    : taskStatementImageState.error
      ? taskStatementImageState.error
      : taskStatementImageState.key
        ? "Изображение сохранено."
        : "Изображение не прикреплено.";

  return {
    taskStatementImageInputRef,
    taskStatementImageState,
    taskStatementImageStatusText,
    handleTaskStatementImageSelected,
    handleTaskStatementImageRemove,
    handleTaskStatementImagePreviewError,
  };
};
