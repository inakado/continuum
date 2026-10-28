"use client";
import { useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { SolutionAnswer } from '@continuum/shared';
import { solutionQueryKeys } from '@/lib/query/keys';
import { solutionsApi } from '@/lib/assessment/solutions.api';
import { apiErrorMessage } from '@/lib/api/error-message';

type Job = { taskId: string; id: string; file: File; replaceId?: string } | { taskId: string; id: string; remove: true };
export type PhotoUploadItem = { id: string; taskId: string; name: string; status: 'waiting' | 'uploading' | 'uploaded' | 'error'; error?: string };
export function useSolutionPhotos(recipientId: string, enabled: boolean) {
  const cache = useQueryClient();
  const key = solutionQueryKeys.answers(recipientId);
  const pending = useRef<Job[]>([]);
  const flight = useRef<Promise<boolean> | null>(null);
  const [uploads, setUploads] = useState<PhotoUploadItem[]>([]);
  const updateUpload = (id: string, patch: Partial<PhotoUploadItem>) => setUploads((items) => items.map((item) => item.id === id ? { ...item, ...patch } : item));
  const canRefresh = () => pending.current.length === 0 && !flight.current;
  const query = useQuery({ queryKey: key, queryFn: () => solutionsApi.list(recipientId), enabled, refetchOnMount: 'always', refetchOnWindowFocus: canRefresh, refetchOnReconnect: canRefresh });
  const mutation = useMutation({ retry: false, networkMode: 'always', mutationFn: async () => {
    await cache.cancelQueries({ queryKey: key });
    while (pending.current.length) {
      const job = pending.current[0];
      if ('file' in job) updateUpload(job.id, { status: 'uploading', error: undefined });
      try {
        const current = cache.getQueryData<SolutionAnswer[]>(key)?.find((item) => item.taskId === job.taskId);
        if (!current) throw new Error('Не удалось загрузить фотографии. Обновите список и повторите.');
        const result = 'remove' in job ? await solutionsApi.remove(recipientId, job.taskId, job.id, current.revision)
          : await solutionsApi.upload(recipientId, job.taskId, job.id, job.file, { revision: current.revision, replaceId: job.replaceId });
        cache.setQueryData(key, result);
        pending.current.shift();
        if ('file' in job) updateUpload(job.id, { status: 'uploaded' });
      } catch (error) {
        if ('file' in job) updateUpload(job.id, { status: 'error', error: apiErrorMessage(error, 'Не удалось загрузить. Файл остался в очереди.') });
        throw error;
      }
    }
  } });
  function flush(): Promise<boolean> {
    if (flight.current) return flight.current;
    if (!pending.current.length) return Promise.resolve(true);
    flight.current = mutation.mutateAsync().then(() => true, () => false).finally(() => { flight.current = null; });
    return flight.current;
  }
  return { answers: query.data ?? [], loading: enabled && query.isPending, ready: query.isSuccess && !query.isFetching, readError: query.error, error: mutation.error, busy: mutation.isPending,
    uploads, pendingTaskId: pending.current[0]?.taskId, refreshing: query.isFetching, pending: pending.current.length > 0, dirty: mutation.isPending || pending.current.length > 0, reload: query.refetch, flush,
    retry: async () => { const result = await query.refetch(); return result.isSuccess ? flush() : false; },
    add: (taskId: string, files: File[], replaceId?: string) => {
      if (pending.current.length) return;
      pending.current = files.map((file) => ({ taskId, id: crypto.randomUUID(), file, replaceId }));
      setUploads(pending.current.map((job, index) => ({ id: job.id, taskId, name: files[index].name, status: 'waiting' })));
      void flush();
    },
    remove: (taskId: string, id: string) => { if (!pending.current.length) { pending.current = [{ taskId, id, remove: true }]; void flush(); } },
    discard: () => { if (!flight.current) { pending.current = []; setUploads((items) => items.filter((item) => item.status === 'uploaded')); mutation.reset(); } },
  };
}
export type StudentSolutionPhotos = ReturnType<typeof useSolutionPhotos>;
