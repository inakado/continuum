import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { getApiErrorMessage } from "@/features/teacher-content/shared/api-errors";
import {
  uploadTeacherCoverImage,
  validateTeacherCoverImageFile,
  type TeacherCoverEntity,
} from "./teacher-cover-image.shared";

type DraftCoverImageState = {
  file: File | null;
  loading: boolean;
  error: string | null;
  updatedAt: number | null;
  previewUrl: string | null;
};

const createInitialDraftCoverImageState = (): DraftCoverImageState => ({
  file: null,
  loading: false,
  error: null,
  updatedAt: null,
  previewUrl: null,
});

export const useTeacherCreateCoverImage = () => {
  const coverImageInputRef = useRef<HTMLInputElement | null>(null);
  const previewObjectUrlRef = useRef<string | null>(null);
  const [coverImageState, setCoverImageState] = useState<DraftCoverImageState>(
    createInitialDraftCoverImageState(),
  );

  const revokePreviewObjectUrl = useCallback(() => {
    if (!previewObjectUrlRef.current) return;
    URL.revokeObjectURL(previewObjectUrlRef.current);
    previewObjectUrlRef.current = null;
  }, []);

  const reset = useCallback(() => {
    revokePreviewObjectUrl();
    if (coverImageInputRef.current) {
      coverImageInputRef.current.value = "";
    }
    setCoverImageState(createInitialDraftCoverImageState());
  }, [revokePreviewObjectUrl]);

  useEffect(() => {
    return () => {
      revokePreviewObjectUrl();
    };
  }, [revokePreviewObjectUrl]);

  const handleCoverImageSelected = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    event.currentTarget.value = "";
    if (!file) return;

    const validationError = validateTeacherCoverImageFile(file);
    if (validationError) {
      setCoverImageState((prev) => ({
        ...prev,
        error: validationError,
      }));
      return;
    }

    revokePreviewObjectUrl();
    const previewUrl = URL.createObjectURL(file);
    previewObjectUrlRef.current = previewUrl;
    setCoverImageState({
      file,
      loading: false,
      error: null,
      updatedAt: Date.now(),
      previewUrl,
    });
  }, [revokePreviewObjectUrl]);

  const handleCoverImageRemove = useCallback(() => {
    reset();
  }, [reset]);

  const uploadAfterCreate = useCallback(
    async (entity: TeacherCoverEntity) => {
      if (!coverImageState.file) return null;

      setCoverImageState((prev) => ({
        ...prev,
        loading: true,
        error: null,
      }));

      try {
        const view = await uploadTeacherCoverImage(entity, coverImageState.file);
        setCoverImageState((prev) => ({
          ...prev,
          loading: false,
          error: null,
          updatedAt: Date.now(),
          previewUrl: view.url,
        }));
        return view;
      } catch (error) {
        setCoverImageState((prev) => ({
          ...prev,
          loading: false,
          error: getApiErrorMessage(error),
        }));
        throw error;
      }
    },
    [coverImageState.file],
  );

  const coverImageStatusText = coverImageState.loading
    ? "Загрузка обложки…"
    : coverImageState.error
      ? coverImageState.error
      : coverImageState.file
        ? "Обложка будет загружена после сохранения."
        : "Обложка не прикреплена.";

  return useMemo(
    () => ({
      coverImageInputRef,
      coverImageState,
      coverImageStatusText,
      handleCoverImageSelected,
      handleCoverImageRemove,
      uploadAfterCreate,
      reset,
    }),
    [
      coverImageState,
      coverImageStatusText,
      handleCoverImageRemove,
      handleCoverImageSelected,
      reset,
      uploadAfterCreate,
    ],
  );
};
