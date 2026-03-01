import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { teacherApi, type Task } from "@/lib/api/teacher";
import { contentQueryKeys } from "@/lib/query/keys";
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
  const queryClient = useQueryClient();
  const taskStatementImageInputRef = useRef<HTMLInputElement | null>(null);
  const [taskStatementImageState, setTaskStatementImageState] = useState<TaskStatementImageState>(
    createInitialTaskStatementImageState(),
  );

  const previewQuery = useQuery({
    queryKey: contentQueryKeys.teacherTaskStatementImagePreview(
      editingTask?.id ?? "",
      taskStatementImageState.key ?? "",
    ),
    queryFn: () => teacherApi.presignTaskStatementImageView(editingTask!.id, 600),
    enabled: Boolean(editingTask?.id && taskStatementImageState.key),
    retry: false,
  });

  const refreshTaskStatementImagePreviewUrl = useCallback(async () => {
    if (!editingTask?.id || !taskStatementImageState.key) return null;
    const response = await queryClient.fetchQuery({
      queryKey: contentQueryKeys.teacherTaskStatementImagePreview(editingTask.id, taskStatementImageState.key),
      queryFn: () => teacherApi.presignTaskStatementImageView(editingTask.id, 600),
      staleTime: 0,
    });
    const nextUrl = buildPdfPreviewSrc(response.url);
    setTaskStatementImageState((prev) => ({
      ...prev,
      key: response.key,
      previewUrl: nextUrl,
      error: null,
    }));
    return nextUrl;
  }, [editingTask?.id, queryClient, taskStatementImageState.key]);

  useEffect(() => {
    if (!editingTask) {
      setTaskStatementImageState(createInitialTaskStatementImageState());
      return;
    }

    setTaskStatementImageState(createInitialTaskStatementImageState(editingTask));
  }, [editingTask?.id, editingTask?.statementImageAssetKey]);

  useEffect(() => {
    if (!previewQuery.data) return;
    setTaskStatementImageState((prev) => ({
      ...prev,
      key: previewQuery.data.key,
      previewUrl: buildPdfPreviewSrc(previewQuery.data.url),
      error: prev.loading ? prev.error : null,
    }));
  }, [previewQuery.data]);

  useEffect(() => {
    if (!previewQuery.error) return;
    setTaskStatementImageState((prev) => ({
      ...prev,
      previewUrl: null,
    }));
  }, [previewQuery.error]);

  const uploadTaskStatementImageMutation = useMutation({
    mutationFn: async ({ taskId, file }: { taskId: string; file: File }) => {
      const presigned = await teacherApi.presignTaskStatementImageUpload(taskId, {
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

      await teacherApi.applyTaskStatementImage(taskId, presigned.assetKey);
      const view = await teacherApi.presignTaskStatementImageView(taskId, 600);
      queryClient.setQueryData(
        contentQueryKeys.teacherTaskStatementImagePreview(taskId, view.key),
        view,
      );
      return view;
    },
  });

  const removeTaskStatementImageMutation = useMutation({
    mutationFn: async (taskId: string) => {
      await teacherApi.deleteTaskStatementImage(taskId);
    },
  });

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
        const view = await uploadTaskStatementImageMutation.mutateAsync({
          taskId: editingTask.id,
          file,
        });

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
    [editingTask, fetchUnit, uploadTaskStatementImageMutation],
  );

  const handleTaskStatementImageRemove = useCallback(async () => {
    if (!editingTask) return;

    setTaskStatementImageState((prev) => ({
      ...prev,
      loading: true,
      error: null,
    }));

    try {
      await removeTaskStatementImageMutation.mutateAsync(editingTask.id);
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
  }, [editingTask, fetchUnit, removeTaskStatementImageMutation]);

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

  const result = useMemo(
    () => ({
      taskStatementImageInputRef,
      taskStatementImageState,
      taskStatementImageStatusText,
      handleTaskStatementImageSelected,
      handleTaskStatementImageRemove,
      handleTaskStatementImagePreviewError,
    }),
    [
      handleTaskStatementImagePreviewError,
      handleTaskStatementImageRemove,
      handleTaskStatementImageSelected,
      taskStatementImageState,
      taskStatementImageStatusText,
    ],
  );

  return result;
};
