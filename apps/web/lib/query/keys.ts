export const authQueryKeys = {
  session: () => ["identity", "session"] as const,
} as const;

export const studentLibraryQueryKeys = {
  all: () => ["student-library"] as const,
  lesson: (lessonId: string) => ["student-library", "lesson", lessonId] as const,
} as const;

export const teacherLibraryQueryKeys = {
  all: () => ["teacher-library"] as const,
  lesson: (lessonId: string) => ["teacher-library", "lesson", lessonId] as const,
} as const;

export const teacherStudentsQueryKeys = {
  all: () => ["teacher-students"] as const,
  classes: () => ["teacher-students", "classes"] as const,
} as const;

export const teacherBankQueryKeys = {
  all: () => ['teacher-assessment-bank'] as const,
  list: (query: object) => ['teacher-assessment-bank', 'list', query] as const,
  task: (id: string, version?: number) => ['teacher-assessment-bank', 'task', id, version ?? 'latest'] as const,
  importTask: (id: string, stableId: string) => ['teacher-assessment-bank', 'import', id, stableId] as const,
} as const;

export const teacherWorkQueryKeys = {
  all: () => ['teacher-assessment-works'] as const,
  list: () => ['teacher-assessment-works', 'list'] as const,
  detail: (id: string) => ['teacher-assessment-works', 'detail', id] as const,
  preview: (id: string, version?: number) => ['teacher-assessment-works', 'preview', id, version ?? 'draft'] as const,
} as const;

export const assignmentQueryKeys = {
  all: () => ['teacher-assignments'] as const,
  list: () => ['teacher-assignments', 'list'] as const,
  prepare: (id: string, version?: number) => ['teacher-assignments', 'prepare', id, version ?? 'draft'] as const,
  report: (id: string) => ['teacher-assignments', 'report', id] as const,
} as const;
export const studentWorkQueryKeys = {
  all: () => ['student-works'] as const,
  list: () => ['student-works', 'list'] as const,
  detail: (id: string) => ['student-works', 'detail', id] as const,
} as const;
export const solutionQueryKeys = {
  answers: (recipientId: string) => ['assessment-solutions', recipientId] as const,
} as const;
export const reviewerQueryKeys = {
  keys: () => ['reviewer-access', 'keys'] as const,
  targets: () => ['reviewer-access', 'targets'] as const,
} as const;
