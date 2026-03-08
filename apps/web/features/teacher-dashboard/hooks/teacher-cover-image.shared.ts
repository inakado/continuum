import {
  ContentCoverImageAllowedContentTypes,
  ContentCoverImageMaxSizeBytes,
} from "@continuum/shared";
import {
  teacherApi,
  type CourseCoverImagePresignViewResponse,
  type SectionCoverImagePresignViewResponse,
} from "@/lib/api/teacher";

export type TeacherCoverEntity =
  | {
      kind: "course";
      id: string;
    }
  | {
      kind: "section";
      id: string;
    };

export type TeacherCoverPreviewResponse =
  | CourseCoverImagePresignViewResponse
  | SectionCoverImagePresignViewResponse;

const ALLOWED_TYPES = new Set(ContentCoverImageAllowedContentTypes);

export const validateTeacherCoverImageFile = (file: File): string | null => {
  if (!ALLOWED_TYPES.has(file.type.toLowerCase() as (typeof ContentCoverImageAllowedContentTypes)[number])) {
    return "Разрешены только JPEG, PNG и WEBP.";
  }

  if (file.size > ContentCoverImageMaxSizeBytes) {
    return `Максимальный размер файла: ${Math.round(ContentCoverImageMaxSizeBytes / (1024 * 1024))} MB.`;
  }

  return null;
};

export const fetchTeacherCoverView = (entity: TeacherCoverEntity) =>
  entity.kind === "course"
    ? teacherApi.presignCourseCoverImageView(entity.id, 600)
    : teacherApi.presignSectionCoverImageView(entity.id, 600);

export const uploadTeacherCoverImage = async (
  entity: TeacherCoverEntity,
  file: File,
): Promise<TeacherCoverPreviewResponse> => {
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

export const deleteTeacherCoverImage = (entity: TeacherCoverEntity) =>
  entity.kind === "course"
    ? teacherApi.deleteCourseCoverImage(entity.id)
    : teacherApi.deleteSectionCoverImage(entity.id);
