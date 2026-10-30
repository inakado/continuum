import type { GradeBand } from '@continuum/shared';

export const gradeLabels: Record<GradeBand, string> = { grade_7: '7 класс', grade_8: '8 класс', grade_9: '9 класс', grade_10_11: '10–11 классы' };
export function libraryParams(grade: string | null, query: string | null) {
  const params = new URLSearchParams();
  if (grade && Object.hasOwn(gradeLabels, grade)) params.set('grade', grade);
  if (query?.trim()) params.set('q', query.slice(0, 200));
  return params;
}
export function libraryHref(grade: string | null, query: string | null, lessonId?: string) {
  const params = libraryParams(grade, query).toString();
  return `/student${params ? `?${params}` : ''}${lessonId ? `#lesson-${encodeURIComponent(lessonId)}` : ''}`;
}
