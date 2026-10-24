"use client";
import { useCallback, useEffect, useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { AssessmentWorkDetail, AssessmentWorkUpdate } from '@continuum/shared';
import { teacherWorkQueryKeys } from '@/lib/query/keys';
import { teacherWorksApi } from './teacher-works.api';
import { ApiError } from '@/lib/api/client';

type WorkDraft = Pick<AssessmentWorkDetail, 'title' | 'instructions' | 'gradeBand' | 'items'>;
const editable = (draft: WorkDraft) => ({ title: draft.title, instructions: draft.instructions, gradeBand: draft.gradeBand, items: draft.items.map((item) => ({ taskId: item.id, version: item.version })) });

export function useWorkDraft(initial: AssessmentWorkDetail) {
  const cache = useQueryClient();
  const [model, setModel] = useState(() => ({ draft: { title: initial.title, instructions: initial.instructions, gradeBand: initial.gradeBand, items: initial.items } as WorkDraft, saved: JSON.stringify(editable(initial)), revision: initial.revision, saving: false, error: null as Error | null }));
  const live = useRef(model);
  const pending = useRef<{ body: AssessmentWorkUpdate; signature: string } | null>(null);
  const flight = useRef<Promise<boolean> | null>(null);
  const stopped = useRef(false);
  const mutation = useMutation({ mutationFn: (body: AssessmentWorkUpdate) => teacherWorksApi.update(initial.id, body), retry: false, networkMode: 'always' });
  const save = mutation.mutateAsync;
  const publish = useCallback((patch: Partial<typeof model>) => { live.current = { ...live.current, ...patch }; setModel(live.current); }, []);
  const flush = useCallback((): Promise<boolean> => {
    if (flight.current) return flight.current;
    if (stopped.current) return Promise.resolve(true);
    if (live.current.error instanceof ApiError && live.current.error.status === 409) return Promise.resolve(false);
    if (!pending.current && !live.current.error && JSON.stringify(editable(live.current.draft)) === live.current.saved) return Promise.resolve(true);
    const run = async () => {
      publish({ saving: true, error: null });
      try {
        while (!stopped.current) {
          const current = live.current;
          const signature = JSON.stringify(editable(current.draft));
          if (!pending.current && signature === current.saved) return true;
          if (!pending.current && !current.draft.title.trim()) throw new ApiError(400, 'Введите название работы перед сохранением.');
          const request = pending.current ?? { body: { ...editable(current.draft), expectedRevision: current.revision, requestId: crypto.randomUUID() }, signature };
          pending.current = request;
          const work = await save(request.body);
          if (stopped.current) return false;
          pending.current = null;
          publish({ revision: work.revision, saved: request.signature });
          cache.setQueryData(teacherWorkQueryKeys.detail(initial.id), work);
          void cache.invalidateQueries({ queryKey: teacherWorkQueryKeys.list() });
        }
        return false;
      } catch (reason) {
        if (!stopped.current) publish({ error: reason instanceof Error ? reason : new Error('Не удалось сохранить работу.') });
        return false;
      } finally { flight.current = null; if (!stopped.current) publish({ saving: false }); }
    };
    flight.current = Promise.resolve().then(run);
    return flight.current;
  }, [cache, initial.id, publish, save]);
  const dirty = JSON.stringify(editable(model.draft)) !== model.saved || model.saving || model.error !== null;
  useEffect(() => {
    if (!dirty || model.error || model.saving || !model.draft.title.trim()) return;
    const timer = setTimeout(() => void flush(), 400);
    return () => clearTimeout(timer);
  }, [dirty, flush, model]);
  useEffect(() => { stopped.current = false; return () => { stopped.current = true; }; }, []);
  return {
    ...model, dirty, flush,
    change: (patch: Partial<WorkDraft>) => publish({ draft: { ...live.current.draft, ...patch } }),
    retry: () => { void flush(); },
    discard: useCallback(() => { stopped.current = true; pending.current = null; }, []),
  };
}
