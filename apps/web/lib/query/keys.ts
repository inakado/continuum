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
} as const;
