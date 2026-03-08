import {
  type TeacherCoverEntity,
  deleteTeacherCoverImage,
  fetchTeacherCoverView,
  uploadTeacherCoverImage,
  validateTeacherCoverImageFile,
  type TeacherCoverPreviewResponse,
} from "./teacher-cover-image.shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { contentQueryKeys } from "@/lib/query/keys";
import { getApiErrorMessage } from "@/features/teacher-content/shared/api-errors";

type EditingCoverEntity =
  | {
      kind: "course";
      id: string;
      assetKey: string | null;
    }
  | {
      kind: "section";
      id: string;
      assetKey: string | null;
    }
  | null;

type CoverImageState = {
  loading: boolean;
  error: string | null;
  updatedAt: number | null;
  key: string | null;
  previewUrl: string | null;
};

type Params = {
  editingEntity: EditingCoverEntity;
  onAfterChange: () => Promise<unknown>;
};
const NOOP_PREVIEW_QUERY_KEY = ["content", "teacher", "cover-image", "noop"] as const;

const createInitialCoverImageState = (editingEntity: EditingCoverEntity): CoverImageState => ({
  loading: false,
  error: null,
  updatedAt: null,
  key: editingEntity?.assetKey ?? null,
  previewUrl: null,
});

const getPreviewQueryKey = (entity: Exclude<EditingCoverEntity, null>, assetKey: string) =>
  entity.kind === "course"
    ? contentQueryKeys.teacherCourseCoverImagePreview(entity.id, assetKey)
    : contentQueryKeys.teacherSectionCoverImagePreview(entity.id, assetKey);

export const useTeacherEditCoverImage = ({ editingEntity, onAfterChange }: Params) => {
  const queryClient = useQueryClient();
  const coverImageInputRef = useRef<HTMLInputElement | null>(null);
  const [coverImageState, setCoverImageState] = useState<CoverImageState>(
    createInitialCoverImageState(editingEntity),
  );

  const previewQuery = useQuery<TeacherCoverPreviewResponse, Error>({
    queryKey:
      editingEntity && coverImageState.key
        ? getPreviewQueryKey(editingEntity, coverImageState.key)
        : NOOP_PREVIEW_QUERY_KEY,
    queryFn: () => fetchTeacherCoverView(editingEntity as TeacherCoverEntity),
    enabled: Boolean(editingEntity && coverImageState.key),
    retry: false,
  });

  const refreshPreviewUrl = useCallback(async () => {
    if (!editingEntity || !coverImageState.key) return null;
    const response = await queryClient.fetchQuery<TeacherCoverPreviewResponse>({
      queryKey: getPreviewQueryKey(editingEntity, coverImageState.key),
      queryFn: () => fetchTeacherCoverView(editingEntity as TeacherCoverEntity),
      staleTime: 0,
    });
    setCoverImageState((prev) => ({
      ...prev,
      key: response.key,
      previewUrl: response.url,
      error: null,
    }));
    return response.url;
  }, [coverImageState.key, editingEntity, queryClient]);

  useEffect(() => {
    setCoverImageState(createInitialCoverImageState(editingEntity));
  }, [editingEntity?.id, editingEntity?.kind]);

  useEffect(() => {
    if (!previewQuery.data) return;
    setCoverImageState((prev) => ({
      ...prev,
      key: previewQuery.data.key,
      previewUrl: previewQuery.data.url,
      error: prev.loading ? prev.error : null,
    }));
  }, [previewQuery.data]);

  useEffect(() => {
    if (!previewQuery.error) return;
    setCoverImageState((prev) => ({
      ...prev,
      previewUrl: null,
    }));
  }, [previewQuery.error]);

  const uploadMutation = useMutation({
    mutationFn: async ({ entity, file }: { entity: Exclude<EditingCoverEntity, null>; file: File }) => {
      const view = await uploadTeacherCoverImage(entity as TeacherCoverEntity, file);
      queryClient.setQueryData(getPreviewQueryKey(entity, view.key), view);
      return view;
    },
  });

  const removeMutation = useMutation({
    mutationFn: async (entity: Exclude<EditingCoverEntity, null>) => {
      await deleteTeacherCoverImage(entity as TeacherCoverEntity);
    },
  });

  const handleCoverImageSelected = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0] ?? null;
      event.currentTarget.value = "";
      if (!editingEntity || !file) return;

      const validationError = validateTeacherCoverImageFile(file);
      if (validationError) {
        setCoverImageState((prev) => ({
          ...prev,
          error: validationError,
        }));
        return;
      }

      setCoverImageState((prev) => ({
        ...prev,
        loading: true,
        error: null,
      }));

      try {
        const view = await uploadMutation.mutateAsync({
          entity: editingEntity,
          file,
        });
        setCoverImageState((prev) => ({
          ...prev,
          loading: false,
          error: null,
          updatedAt: Date.now(),
          key: view.key,
          previewUrl: view.url,
        }));
        await onAfterChange();
      } catch (error) {
        setCoverImageState((prev) => ({
          ...prev,
          loading: false,
          error: getApiErrorMessage(error),
        }));
      }
    },
    [editingEntity, onAfterChange, uploadMutation],
  );

  const handleCoverImageRemove = useCallback(async () => {
    if (!editingEntity) return;

    setCoverImageState((prev) => ({
      ...prev,
      loading: true,
      error: null,
    }));

    try {
      await removeMutation.mutateAsync(editingEntity);
      setCoverImageState((prev) => ({
        ...prev,
        loading: false,
        error: null,
        updatedAt: Date.now(),
        key: null,
        previewUrl: null,
      }));
      await onAfterChange();
    } catch (error) {
      setCoverImageState((prev) => ({
        ...prev,
        loading: false,
        error: getApiErrorMessage(error),
      }));
    }
  }, [editingEntity, onAfterChange, removeMutation]);

  const handleCoverImagePreviewError = useCallback(() => {
    void refreshPreviewUrl().catch((error) => {
      setCoverImageState((prev) => ({
        ...prev,
        error: getApiErrorMessage(error),
      }));
    });
  }, [refreshPreviewUrl]);

  const coverImageStatusText = coverImageState.loading
    ? "Загрузка обложки…"
    : coverImageState.error
      ? coverImageState.error
      : coverImageState.key
        ? "Обложка сохранена."
        : "Обложка не прикреплена.";

  return useMemo(
    () => ({
      coverImageInputRef,
      coverImageState,
      coverImageStatusText,
      handleCoverImageSelected,
      handleCoverImageRemove,
      handleCoverImagePreviewError,
    }),
    [
      coverImageState,
      coverImageStatusText,
      handleCoverImagePreviewError,
      handleCoverImageRemove,
      handleCoverImageSelected,
    ],
  );
};
