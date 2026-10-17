import { AssignmentCreatedSchema, AssignmentListSchema, AssignmentPrepareSchema, AssignmentReportSchema, type AssignmentCreate } from '@continuum/shared';
import { apiRequestParsed } from '@/lib/api/client';

const root = '/teacher/assessment-assignments';
export const teacherAssignmentsApi = {
  list: () => apiRequestParsed(root, AssignmentListSchema),
  prepare: (workId: string, version?: number) => apiRequestParsed(`${root}/works/${workId}/prepare${version ? `?version=${version}` : ''}`, AssignmentPrepareSchema),
  assign: (workId: string, body: AssignmentCreate) => apiRequestParsed(`${root}/works/${workId}`, AssignmentCreatedSchema, { method: 'POST', body }),
  report: (id: string) => apiRequestParsed(`${root}/${id}`, AssignmentReportSchema),
};
