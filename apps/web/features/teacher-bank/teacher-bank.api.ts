import { AssessmentBankListSchema, AssessmentImportPreviewSchema, AssessmentImportResultSchema, AssessmentTaskViewSchema, type AssessmentBankQuery } from '@continuum/shared';
import { apiRequest, apiRequestParsed, ApiError } from '@/lib/api/client';

const root = '/teacher/assessment-bank';
const base = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3000';
const queryString = (query: AssessmentBankQuery) => new URLSearchParams(Object.entries(query).filter(([, value]) => value !== undefined && value !== '').map(([key, value]) => [key, String(value)])).toString();

export const teacherBankApi = {
  list: (query: AssessmentBankQuery) => apiRequestParsed(`${root}?${queryString(query)}`, AssessmentBankListSchema),
  view: (id: string, version?: number) => apiRequestParsed(`${root}/tasks/${id}${version ? `?version=${version}` : ''}`, AssessmentTaskViewSchema),
  preview: (file: File) => apiRequestParsed(`${root}/imports/preview`, AssessmentImportPreviewSchema, { method: 'POST', body: file, contentType: 'application/zip' }),
  previewTask: (id: string, stableId: string) => apiRequestParsed(`${root}/imports/${id}/tasks/${encodeURIComponent(stableId)}`, AssessmentTaskViewSchema),
  confirm: (id: string) => apiRequestParsed(`${root}/imports/${id}/confirm`, AssessmentImportResultSchema, { method: 'POST' }),
  discard: (id: string) => apiRequest(`${root}/imports/${id}`, { method: 'DELETE' }),
  async export(query: AssessmentBankQuery) {
    const response = await fetch(`${base}${root}/export?${queryString(query)}`, { credentials: 'include', cache: 'no-store' });
    if (!response.ok) {
      const error: { message?: string } = await response.json().catch(() => ({}));
      throw new ApiError(response.status, error.message || 'Не удалось экспортировать задания.');
    }
    const url = URL.createObjectURL(await response.blob());
    const link = document.createElement('a'); link.href = url; link.download = 'continuum-assessments.zip'; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  },
};
