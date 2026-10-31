"use client";
import { useCallback, useEffect, useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { AssessmentAnswer, AttemptSave, StudentAttemptState, StudentWorkDetail } from '@continuum/shared';
import { studentWorkQueryKeys } from '@/lib/query/keys';
import { studentWorksApi } from './student-works.api';
import { ApiError } from '@/lib/api/client';

const answerSignature = (answer?: AssessmentAnswer | null) => JSON.stringify(answer ?? null);
export function useStudentAttempt(initial: StudentWorkDetail) {
  const cache = useQueryClient();
  const [model, setModel] = useState({ answers: initial.answers, saved: initial.answers, state: initial as StudentAttemptState, saving: false, error: null as Error | null });
  const live = useRef(model);
  const [finishError, setFinishError] = useState<Error | null>(null);
  const [online, setOnline] = useState(() => typeof navigator === 'undefined' || navigator.onLine);
  const pending = useRef<{ taskId: string; body: AttemptSave } | null>(null);
  const flight = useRef<Promise<boolean> | null>(null);
  const write = useMutation({ mutationFn: ({ taskId, body }: { taskId: string; body: AttemptSave }) => studentWorksApi.save(initial.id, taskId, body), retry: false, networkMode: 'always' });
  const finalize = useMutation({ mutationFn: (revision: number) => studentWorksApi.finish(initial.id, revision), retry: false, networkMode: 'always' });
  const save = write.mutateAsync;
  const publish = useCallback((patch: Partial<typeof model>) => { live.current = { ...live.current, ...patch }; setModel(live.current); }, []);
  useEffect(() => {
    if (initial.status !== 'completed' || live.current.state.status !== 'completed') return;
    if (JSON.stringify([initial.result, initial.taskResults, initial.answerKeys]) === JSON.stringify([live.current.state.result, live.current.state.taskResults, live.current.state.answerKeys])) return;
    publish({ state: { ...live.current.state, result: initial.result, taskResults: initial.taskResults, answerKeys: initial.answerKeys } });
  }, [initial.status, initial.result, initial.taskResults, initial.answerKeys, publish]);
  const flush = useCallback((): Promise<boolean> => {
    if (flight.current) return flight.current;
    if (live.current.state.status !== 'in_progress') return Promise.resolve(true);
    if (!pending.current && initial.items.every((item) => answerSignature(live.current.answers[item.id]) === answerSignature(live.current.saved[item.id]))) return Promise.resolve(true);
    publish({ error: null, saving: true });
    const run = async () => {
      try {
        for (;;) {
          const current = live.current;
          const changed = initial.items.find((item) => answerSignature(current.answers[item.id]) !== answerSignature(current.saved[item.id]));
          if (!pending.current && !changed) return true;
          const request = pending.current ?? { taskId: changed!.id, body: { requestId: crypto.randomUUID(), expectedRevision: current.state.revision, answer: current.answers[changed!.id] ?? null } };
          pending.current = request;
          const result = await save(request);
          const saved = { ...live.current.saved };
          if (request.body.answer) saved[request.taskId] = request.body.answer; else delete saved[request.taskId];
          pending.current = null;
          publish({ saved, state: result });
          cache.setQueryData<StudentWorkDetail>(studentWorkQueryKeys.detail(initial.id), (previous) => previous ? { ...previous, ...result, answers: saved } : previous);
          void cache.invalidateQueries({ queryKey: studentWorkQueryKeys.list() });
        }
      } catch (reason) {
        publish({ error: reason instanceof Error ? reason : new Error('Не удалось сохранить ответ.') });
        return false;
      } finally { flight.current = null; publish({ saving: false }); }
    };
    flight.current = Promise.resolve().then(run);
    return flight.current;
  }, [cache, initial.id, initial.items, publish, save]);
  const changed = initial.items.some((item) => answerSignature(model.answers[item.id]) !== answerSignature(model.saved[item.id]));
  const dirty = model.state.status === 'in_progress' && (changed || model.saving || model.error !== null);
  useEffect(() => {
    if (model.state.status !== 'in_progress' || model.error || model.saving || !changed) return;
    const timer = setTimeout(() => void flush(), 400);
    return () => clearTimeout(timer);
  }, [changed, flush, model]);
  useEffect(() => {
    const reconnect = () => { setOnline(true); const error = live.current.error; if (error && !(error instanceof ApiError)) void flush(); };
    const offline = () => setOnline(false);
    window.addEventListener('online', reconnect); window.addEventListener('offline', offline);
    return () => { window.removeEventListener('online', reconnect); window.removeEventListener('offline', offline); };
  }, [flush]);
  async function finish() {
    if (dirty || flight.current || model.state.status !== 'in_progress' || finalize.isPending) return;
    setFinishError(null);
    try {
      const result = await finalize.mutateAsync(live.current.state.revision);
      publish({ state: result });
      cache.setQueryData<StudentWorkDetail>(studentWorkQueryKeys.detail(initial.id), (previous) => previous ? { ...previous, ...result } : previous);
      void cache.invalidateQueries({ queryKey: studentWorkQueryKeys.list() });
    } catch (reason) { setFinishError(reason instanceof Error ? reason : new Error('Не удалось завершить работу.')); }
  }
  return { ...model, dirty, online, finishError, finishing: finalize.isPending, finish, flush,
    discard: useCallback(() => { pending.current = null; publish({ answers: live.current.saved, error: null }); }, [publish]),
    change: (id: string, answer: AssessmentAnswer | null) => {
      if (finalize.isPending || live.current.state.status !== 'in_progress') return;
      const answers = { ...live.current.answers };
      if (answer) answers[id] = answer; else delete answers[id];
      publish({ answers });
    },
    retry: () => { setFinishError(null); void flush(); },
  };
}
