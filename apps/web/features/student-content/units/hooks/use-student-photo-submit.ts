import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback, useRef, useState, type ChangeEvent } from "react";
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

export const useStudentPhotoSubmit = ({ activeTask, activeState, unitId }: Params) => {
  const queryClient = useQueryClient();
  const photoFileInputRef = useRef<HTMLInputElement | null>(null);
  const [photoSelectedFilesByTask, setPhotoSelectedFilesByTask] = useState<Record<string, File[]>>({});
  const [photoLoadingByTask, setPhotoLoadingByTask] = useState<Record<string, boolean>>({});
  const [photoFileDialogTaskId, setPhotoFileDialogTaskId] = useState<string | null>(null);

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
    openPhotoFileDialog,
    submitPhotoTask,
  };
};
