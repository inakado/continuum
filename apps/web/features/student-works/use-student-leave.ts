"use client";
import { useCallback, useEffect, useRef, useState } from 'react';
import { observeHistoryTraversal } from '@/lib/navigation/history-position';

export function useStudentLeave(dirty: boolean, flush: () => Promise<boolean>, discard: () => void) {
  const [leaving, setLeaving] = useState(false);
  const [failed, setFailed] = useState(false);
  const decision = useRef<((value: 'stay' | 'retry' | 'discard') => void) | null>(null);
  const flight = useRef<Promise<boolean> | null>(null);
  const allowed = useRef(false);
  const operations = useRef({ flush, discard });
  useEffect(() => { operations.current = { flush, discard }; }, [discard, flush]);
  const request = useCallback(() => {
    if (flight.current) return Promise.resolve(false);
    const run = async () => {
      setLeaving(true);
      try {
        for (;;) {
          if (await operations.current.flush()) { allowed.current = true; return true; }
          setFailed(true);
          const choice = await new Promise<'stay' | 'retry' | 'discard'>((resolve) => { decision.current = resolve; });
          setFailed(false);
          if (choice === 'stay') return false;
          if (choice === 'discard') { operations.current.discard(); allowed.current = true; return true; }
        }
      } finally { flight.current = null; setLeaving(false); }
    };
    flight.current = Promise.resolve().then(run);
    return flight.current;
  }, []);
  useEffect(() => {
    allowed.current = false;
    if (!dirty) return;
    const protect = (event: BeforeUnloadEvent) => { if (!allowed.current) { event.preventDefault(); event.returnValue = ''; } };
    window.addEventListener('beforeunload', protect);
    let transition: { origin: number; destination: number } | null = null;
    let resuming = false;
    let deciding = false;
    const stop = observeHistoryTraversal(({ from, to, event }) => {
      if (from === to || resuming || allowed.current) return;
      event.stopImmediatePropagation();
      if (transition && to === transition.origin) {
        if (deciding) return;
        deciding = true;
        const selected = transition;
        void request().then((proceed) => { if (proceed) { resuming = true; history.go(selected.destination - selected.origin); } else transition = null; }).finally(() => { deciding = false; });
      } else {
        transition ??= { origin: from, destination: to };
        history.go(transition.origin - to);
      }
    });
    return () => { window.removeEventListener('beforeunload', protect); stop(); };
  }, [dirty, request]);
  useEffect(() => () => { decision.current?.('stay'); }, []);
  return { request, leaving, failed, decide: (value: 'stay' | 'retry' | 'discard') => { decision.current?.(value); decision.current = null; } };
}
