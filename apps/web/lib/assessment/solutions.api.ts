import { SolutionAnswersSchema, type SolutionPhotoMutation } from '@continuum/shared';
import { apiRequestParsed } from '@/lib/api/client';

const root = (id: string) => `/assessment-solutions/${id}`;
export const solutionsApi = {
  list: (id: string) => apiRequestParsed(root(id), SolutionAnswersSchema),
  upload: (id: string, taskId: string, photoId: string, file: File, input: SolutionPhotoMutation) => {
    const query = new URLSearchParams({ revision: String(input.revision), ...(input.replaceId ? { replaceId: input.replaceId } : {}) });
    return apiRequestParsed(`${root(id)}/items/${taskId}/photos/${photoId}?${query}`, SolutionAnswersSchema, { method: 'PUT', body: file, signal: AbortSignal.timeout(60_000) });
  },
  remove: (id: string, taskId: string, photoId: string, revision: number) => apiRequestParsed(`${root(id)}/items/${taskId}/photos/${photoId}?revision=${revision}`, SolutionAnswersSchema, { method: 'DELETE', signal: AbortSignal.timeout(20_000) }),
};
