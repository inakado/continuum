import type { AssessmentBankQuery } from '@continuum/shared';

export const uploadDateLabel = (date: string) => new Date(date).toLocaleDateString('ru-RU');

export function uploadDateValue(date?: string) {
  if (!date) return '';
  const local = new Date(date);
  return `${local.getFullYear()}-${String(local.getMonth() + 1).padStart(2, '0')}-${String(local.getDate()).padStart(2, '0')}`;
}

export function uploadDateFilter(date: string): Pick<AssessmentBankQuery, 'uploadedFrom' | 'uploadedBefore'> {
  if (!date) return { uploadedFrom: undefined, uploadedBefore: undefined };
  const start = new Date(`${date}T00:00:00`);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { uploadedFrom: start.toISOString(), uploadedBefore: end.toISOString() };
}
