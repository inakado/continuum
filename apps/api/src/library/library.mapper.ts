import type {
  GradeBand,
  LessonArtifact,
  LessonDetail,
  LessonSummary,
  LibrarySection,
} from '@continuum/shared';
import type {
  GradeBand as DbGradeBand,
  LessonArtifactType,
  PublicationStatus,
} from '@prisma/client';

type ArtifactFormatRow = {
  type: LessonArtifactType;
};

type LessonSummaryRow = {
  id: string;
  title: string;
  description: string | null;
  status: PublicationStatus;
  sortOrder: number;
  artifacts: ArtifactFormatRow[];
};

type SectionRow = {
  id: string;
  gradeBand: DbGradeBand;
  title: string;
  description: string | null;
  status: PublicationStatus;
  sortOrder: number;
  lessons: LessonSummaryRow[];
};

type LessonDetailRow = LessonSummaryRow & {
  section: {
    id: string;
    gradeBand: DbGradeBand;
    title: string;
  };
  artifacts: Array<{
    id: string;
    type: LessonArtifactType;
    version: number;
    status: PublicationStatus;
    isActive: boolean;
    publishedAt: Date | null;
    asset: {
      filename: string;
      contentType: string;
      sizeBytes: bigint;
    };
  }>;
};

export const mapLessonSummary = (lesson: LessonSummaryRow): LessonSummary => ({
  id: lesson.id,
  title: lesson.title,
  description: lesson.description,
  status: lesson.status,
  sortOrder: lesson.sortOrder,
  formats: {
    pdf: lesson.artifacts.some((artifact) => artifact.type === 'pdf'),
    interactive: lesson.artifacts.some((artifact) => artifact.type === 'interactive'),
    tasks: lesson.artifacts.some((artifact) => artifact.type === 'tasks_pdf'),
  },
});

export const mapLibrarySection = (section: SectionRow): LibrarySection => ({
  id: section.id,
  gradeBand: section.gradeBand as GradeBand,
  title: section.title,
  description: section.description,
  status: section.status,
  sortOrder: section.sortOrder,
  lessons: section.lessons.map(mapLessonSummary),
});

const mapLessonArtifact = (artifact: LessonDetailRow['artifacts'][number]): LessonArtifact => ({
  id: artifact.id,
  type: artifact.type,
  version: artifact.version,
  filename: artifact.asset.filename,
  contentType: artifact.asset.contentType,
  sizeBytes: Number(artifact.asset.sizeBytes),
  status: artifact.status,
  isActive: artifact.isActive,
  publishedAt: artifact.publishedAt?.toISOString() ?? null,
});

export const mapLessonDetail = (lesson: LessonDetailRow): LessonDetail => ({
  ...mapLessonSummary(lesson),
  section: {
    id: lesson.section.id,
    gradeBand: lesson.section.gradeBand as GradeBand,
    title: lesson.section.title,
  },
  artifacts: lesson.artifacts.map(mapLessonArtifact),
});
