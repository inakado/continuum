import { AssessmentWorkDetailSchema, AssessmentWorkListSchema, AssessmentWorkVersionSchema, type AssessmentWorkCreate, type AssessmentWorkUpdate } from '@continuum/shared';
import { apiRequestParsed } from '@/lib/api/client';

const root = '/teacher/assessment-works';
export const teacherWorksApi = {
  list: () => apiRequestParsed(root, AssessmentWorkListSchema),
  detail: (id: string) => apiRequestParsed(`${root}/${id}`, AssessmentWorkDetailSchema),
  version: (id: string, number: number) => apiRequestParsed(`${root}/${id}/versions/${number}`, AssessmentWorkVersionSchema),
  create: (body: AssessmentWorkCreate) => apiRequestParsed(root, AssessmentWorkDetailSchema, { method: 'POST', body }),
  update: (id: string, body: AssessmentWorkUpdate) => apiRequestParsed(`${root}/${id}`, AssessmentWorkDetailSchema, { method: 'PATCH', body }),
  freeze: (id: string, expectedRevision: number) => apiRequestParsed(`${root}/${id}/versions`, AssessmentWorkVersionSchema, { method: 'POST', body: { expectedRevision } }),
};
