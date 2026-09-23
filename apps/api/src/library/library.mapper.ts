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
  _count: { tasks: number };
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
    publishedAt: Date | null;
    asset: {
      filename: string;
      contentType: string;
      sizeBytes: bigint;
    };
  }>;
  tasks: Array<{
    id: string;
    title: string | null;
    body: string;
    sortOrder: number;
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
    tasks: lesson._count.tasks > 0,
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
  tasks: lesson.tasks.map((task) => ({
    id: task.id,
    title: task.title,
    body: task.body,
    imageUrl: null,
    diagramPreviewUrl: null,
    sortOrder: task.sortOrder,
  })),
});
