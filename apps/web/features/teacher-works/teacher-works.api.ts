import { AssessmentWorkMutationResultSchema, AssessmentWorkDetailSchema, AssessmentWorkListSchema, AssessmentWorkVersionSchema, type AssessmentWorkArchive, type AssessmentWorkDelete, type AssessmentWorkCopy, type AssessmentWorkCreate, type AssessmentWorkUpdate } from '@continuum/shared';
import { apiRequestParsed } from '@/lib/api/client';
import { AssessmentWorkAnswerCheckResultSchema, type AssessmentWorkAnswerCheck } from '@continuum/shared';

const root = '/teacher/assessment-works';
export const teacherWorksApi = {
  list: () => apiRequestParsed(root, AssessmentWorkListSchema),
  detail: (id: string) => apiRequestParsed(`${root}/${id}`, AssessmentWorkDetailSchema),
  version: (id: string, number: number) => apiRequestParsed(`${root}/${id}/versions/${number}`, AssessmentWorkVersionSchema),
  create: (body: AssessmentWorkCreate) => apiRequestParsed(root, AssessmentWorkDetailSchema, { method: 'POST', body }),
  copy: ({ sourceId, input }: { sourceId: string; input: AssessmentWorkCopy }) => apiRequestParsed(`${root}/${sourceId}/copy`, AssessmentWorkDetailSchema, { method: 'POST', body: input }),
  archive: ({ id, input }: { id: string; input: AssessmentWorkArchive }) => apiRequestParsed(`${root}/${id}/archive`, AssessmentWorkMutationResultSchema, { method: 'PATCH', body: input }),
  remove: ({ id, input }: { id: string; input: AssessmentWorkDelete }) => apiRequestParsed(`${root}/${id}`, AssessmentWorkMutationResultSchema, { method: 'DELETE', body: input }),
  update: (id: string, body: AssessmentWorkUpdate) => apiRequestParsed(`${root}/${id}`, AssessmentWorkDetailSchema, { method: 'PATCH', body }),
  freeze: (id: string, expectedRevision: number) => apiRequestParsed(`${root}/${id}/versions`, AssessmentWorkVersionSchema, { method: 'POST', body: { expectedRevision } }),
  checkAnswer: (id: string, body: AssessmentWorkAnswerCheck) => apiRequestParsed(`${root}/${id}/check-answer`, AssessmentWorkAnswerCheckResultSchema, { method: 'POST', body }),
};
