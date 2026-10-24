"use client";
import { useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { SolutionAnswer } from '@continuum/shared';
import { solutionQueryKeys } from '@/lib/query/keys';
import { solutionsApi } from '@/lib/assessment/solutions.api';

type Job = { taskId: string; id: string; file: File; replaceId?: string } | { taskId: string; id: string; remove: true };
export function useSolutionPhotos(recipientId: string, enabled: boolean) {
  const cache = useQueryClient();
  const key = solutionQueryKeys.answers(recipientId);
  const pending = useRef<Job[]>([]);
  const flight = useRef<Promise<boolean> | null>(null);
  const canRefresh = () => pending.current.length === 0 && !flight.current;
  const query = useQuery({ queryKey: key, queryFn: () => solutionsApi.list(recipientId), enabled, refetchOnMount: 'always', refetchOnWindowFocus: canRefresh, refetchOnReconnect: canRefresh });
  const mutation = useMutation({ retry: false, networkMode: 'always', mutationFn: async () => {
    await cache.cancelQueries({ queryKey: key });
    while (pending.current.length) {
      const job = pending.current[0];
      const current = cache.getQueryData<SolutionAnswer[]>(key)?.find((item) => item.taskId === job.taskId);
      if (!current) throw new Error('Не удалось загрузить фотографии. Обновите список и повторите.');
      const result = 'remove' in job ? await solutionsApi.remove(recipientId, job.taskId, job.id, current.revision)
        : await solutionsApi.upload(recipientId, job.taskId, job.id, job.file, { revision: current.revision, replaceId: job.replaceId });
      cache.setQueryData(key, result);
      pending.current.shift();
    }
  } });
  function flush(): Promise<boolean> {
    if (flight.current) return flight.current;
    if (!pending.current.length) return Promise.resolve(true);
    flight.current = mutation.mutateAsync().then(() => true, () => false).finally(() => { flight.current = null; });
    return flight.current;
  }
  return { answers: query.data ?? [], loading: enabled && query.isPending, ready: query.isSuccess && !query.isFetching, readError: query.error, error: mutation.error, busy: mutation.isPending,
    pending: pending.current.length > 0, dirty: mutation.isPending || pending.current.length > 0, reload: query.refetch, flush,
    add: (taskId: string, files: File[], replaceId?: string) => {
      if (pending.current.length) return;
      pending.current = files.map((file) => ({ taskId, id: crypto.randomUUID(), file, replaceId }));
      void flush();
    },
    remove: (taskId: string, id: string) => { if (!pending.current.length) { pending.current = [{ taskId, id, remove: true }]; void flush(); } },
    discard: () => { if (!flight.current) { pending.current = []; mutation.reset(); } },
  };
}
export type StudentSolutionPhotos = ReturnType<typeof useSolutionPhotos>;
