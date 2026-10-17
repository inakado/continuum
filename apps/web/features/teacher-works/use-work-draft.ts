"use client";
import { useEffect, useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { AssessmentWorkDetail, AssessmentWorkUpdate } from '@continuum/shared';
import { teacherWorkQueryKeys } from '@/lib/query/keys';
import { teacherWorksApi } from './teacher-works.api';

type WorkDraft = Pick<AssessmentWorkDetail, 'title' | 'instructions' | 'gradeBand' | 'items'>;
const editable = (draft: WorkDraft) => ({ title: draft.title, instructions: draft.instructions, gradeBand: draft.gradeBand, items: draft.items.map((item) => ({ taskId: item.id, version: item.version })) });

export function useWorkDraft(initial: AssessmentWorkDetail) {
  const cache = useQueryClient();
  const [draft, setDraft] = useState<WorkDraft>(() => ({ title: initial.title, instructions: initial.instructions, gradeBand: initial.gradeBand, items: initial.items }));
  const signature = JSON.stringify(editable(draft));
  const [saved, setSaved] = useState(() => JSON.stringify(editable(initial)));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const revision = useRef(initial.revision);
  const pending = useRef<{ body: AssessmentWorkUpdate; signature: string } | null>(null);
  const inFlight = useRef(false);
  const mutation = useMutation({ mutationFn: (body: AssessmentWorkUpdate) => teacherWorksApi.update(initial.id, body), retry: false });
  const save = mutation.mutateAsync;
  const dirty = signature !== saved || saving || error !== null;
  useEffect(() => {
    if (error || inFlight.current || (!pending.current && signature === saved) || !draft.title.trim()) return;
    const timer = setTimeout(() => {
      const request = pending.current ?? { body: { ...editable(draft), expectedRevision: revision.current, requestId: crypto.randomUUID() }, signature };
      pending.current = request;
      inFlight.current = true; setSaving(true);
      void save(request.body).then((work) => {
        revision.current = work.revision;
        pending.current = null;
        setSaved(request.signature);
        cache.setQueryData(teacherWorkQueryKeys.detail(initial.id), work);
        void cache.invalidateQueries({ queryKey: teacherWorkQueryKeys.list() });
      }).catch((reason: Error) => setError(reason)).finally(() => { inFlight.current = false; setSaving(false); });
    }, 400);
    return () => clearTimeout(timer);
  }, [signature, saved, saving, error, draft, initial.id, save, cache]);
  useEffect(() => {
    if (!dirty) return;
    const protect = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', protect);
    return () => window.removeEventListener('beforeunload', protect);
  }, [dirty]);
  return {
    draft, dirty, saving, error, revision: revision.current,
    change: (patch: Partial<WorkDraft>) => setDraft((previous) => ({ ...previous, ...patch })),
    retry: () => setError(null),
    canLeave: () => !dirty || window.confirm('Изменения ещё не сохранены. Выйти без сохранения?'),
  };
}
