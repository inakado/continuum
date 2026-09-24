import { BadRequestException } from '@nestjs/common';
import type { LessonArtifactType } from '@continuum/shared';

type ArtifactFile = {
  type: LessonArtifactType;
  filename: string;
  contentType: string;
  sizeBytes: number;
};

const MEBIBYTE = 1024 * 1024;

const policies: Record<
  LessonArtifactType,
  { extensions: string[]; contentTypes: string[]; maxSizeBytes: number }
> = {
  pdf: {
    extensions: ['.pdf'],
    contentTypes: ['application/pdf'],
    maxSizeBytes: 50 * MEBIBYTE,
  },
  tasks_pdf: {
    extensions: ['.pdf'],
    contentTypes: ['application/pdf'],
    maxSizeBytes: 50 * MEBIBYTE,
  },
  interactive: {
    extensions: ['.zip'],
    contentTypes: ['application/zip', 'application/x-zip-compressed'],
    maxSizeBytes: 200 * MEBIBYTE,
  },
};

export const assertLessonArtifactFile = (file: ArtifactFile) => {
  const policy = policies[file.type];
  const normalizedName = file.filename.trim().toLowerCase();

  if (!policy.extensions.some((extension) => normalizedName.endsWith(extension))) {
    throw new BadRequestException({
      code: 'ARTIFACT_FILE_TYPE_INVALID',
      message: file.type === 'interactive' ? 'Загрузите ZIP-пакет.' : 'Загрузите PDF-файл.',
    });
  }
  if (!policy.contentTypes.includes(file.contentType)) {
    throw new BadRequestException({
      code: 'ARTIFACT_CONTENT_TYPE_INVALID',
      message: 'Тип файла не соответствует выбранному материалу.',
    });
  }
  if (file.sizeBytes > policy.maxSizeBytes) {
    throw new BadRequestException({
      code: 'ARTIFACT_FILE_TOO_LARGE',
      message: file.type === 'interactive' ? 'Пакет больше 200 МБ.' : 'PDF больше 50 МБ.',
    });
  }
};

export const safeArtifactFilename = (filename: string) => {
  const normalized = filename
    .normalize('NFKC')
    .replace(/[\\/]+/g, '-')
    .replace(/[^\p{L}\p{N}._-]+/gu, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return normalized || 'material';
};
