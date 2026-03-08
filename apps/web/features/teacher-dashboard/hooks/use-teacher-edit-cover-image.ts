import {
  ContentCoverImageAllowedContentTypes,
  ContentCoverImageMaxSizeBytes,
} from "@continuum/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import {
  teacherApi,
  type CourseCoverImagePresignViewResponse,
  type SectionCoverImagePresignViewResponse,
} from "@/lib/api/teacher";
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

type CoverImagePreviewResponse =
  | CourseCoverImagePresignViewResponse
  | SectionCoverImagePresignViewResponse;

const ALLOWED_TYPES = new Set(ContentCoverImageAllowedContentTypes);
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

const fetchCoverView = (entity: Exclude<EditingCoverEntity, null>) =>
  entity.kind === "course"
    ? teacherApi.presignCourseCoverImageView(entity.id, 600)
    : teacherApi.presignSectionCoverImageView(entity.id, 600);

const uploadCover = async (entity: Exclude<EditingCoverEntity, null>, file: File) => {
  if (entity.kind === "course") {
    const presigned = await teacherApi.presignCourseCoverImageUpload(entity.id, {
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
    await teacherApi.applyCourseCoverImage(entity.id, presigned.assetKey);
    return teacherApi.presignCourseCoverImageView(entity.id, 600);
  }

  const presigned = await teacherApi.presignSectionCoverImageUpload(entity.id, {
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
  await teacherApi.applySectionCoverImage(entity.id, presigned.assetKey);
  return teacherApi.presignSectionCoverImageView(entity.id, 600);
};

const deleteCover = (entity: Exclude<EditingCoverEntity, null>) =>
  entity.kind === "course"
    ? teacherApi.deleteCourseCoverImage(entity.id)
    : teacherApi.deleteSectionCoverImage(entity.id);

export const useTeacherEditCoverImage = ({ editingEntity, onAfterChange }: Params) => {
  const queryClient = useQueryClient();
  const coverImageInputRef = useRef<HTMLInputElement | null>(null);
  const [coverImageState, setCoverImageState] = useState<CoverImageState>(
    createInitialCoverImageState(editingEntity),
  );

  const previewQuery = useQuery<CoverImagePreviewResponse, Error>({
    queryKey:
      editingEntity && coverImageState.key
        ? getPreviewQueryKey(editingEntity, coverImageState.key)
        : NOOP_PREVIEW_QUERY_KEY,
    queryFn: () => fetchCoverView(editingEntity!),
    enabled: Boolean(editingEntity && coverImageState.key),
    retry: false,
  });

  const refreshPreviewUrl = useCallback(async () => {
    if (!editingEntity || !coverImageState.key) return null;
    const response = await queryClient.fetchQuery<CoverImagePreviewResponse>({
      queryKey: getPreviewQueryKey(editingEntity, coverImageState.key),
      queryFn: () => fetchCoverView(editingEntity),
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
  }, [editingEntity?.id, editingEntity?.assetKey, editingEntity?.kind]);

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
      const view = await uploadCover(entity, file);
      queryClient.setQueryData(getPreviewQueryKey(entity, view.key), view);
      return view;
    },
  });

  const removeMutation = useMutation({
    mutationFn: async (entity: Exclude<EditingCoverEntity, null>) => {
      await deleteCover(entity);
    },
  });

  const handleCoverImageSelected = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0] ?? null;
      event.currentTarget.value = "";
      if (!editingEntity || !file) return;

      if (!ALLOWED_TYPES.has(file.type.toLowerCase() as (typeof ContentCoverImageAllowedContentTypes)[number])) {
        setCoverImageState((prev) => ({
          ...prev,
          error: "Разрешены только JPEG, PNG и WEBP.",
        }));
        return;
      }

      if (file.size > ContentCoverImageMaxSizeBytes) {
        setCoverImageState((prev) => ({
          ...prev,
          error: `Максимальный размер файла: ${Math.round(
            ContentCoverImageMaxSizeBytes / (1024 * 1024),
          )} MB.`,
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
