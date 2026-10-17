"use client";
import { useEffect, useRef, useState } from 'react';
import type { AssessmentAnswer, StudentWorkDetail } from '@continuum/shared';
import { clearAnswerDrafts, draftMatchesServer, readAnswerDraft, removeAnswerDraft, type AnswerDraft } from '@/lib/assessment/answer-draft';

export function useAnswerDraft(owner: string, work: StudentWorkDetail, answers: StudentWorkDetail['answers'], saved: StudentWorkDetail['answers'], completed: boolean) {
  const [candidate, setCandidate] = useState<AnswerDraft | null>(null);
  const loaded = useRef('');
  const restoredIds = useRef<string[]>([]);
  useEffect(() => {
    if (!owner || loaded.current === `${owner}:${work.id}`) return;
    loaded.current = `${owner}:${work.id}`;
    clearAnswerDrafts(owner);
    const found = readAnswerDraft(owner, work);
    if (found) {
      const ids = new Set([...Object.keys(found.answers), ...Object.keys(found.base)]);
      const acknowledged = [...ids].every((id) => JSON.stringify(found.answers[id] ?? null) === JSON.stringify(work.answers[id] ?? null));
      if (acknowledged) removeAnswerDraft(owner, work);
      else setCandidate(found);
    }
  }, [owner, work]);
  useEffect(() => {
    if (!owner || candidate) return;
    if (completed || (restoredIds.current.length && restoredIds.current.every((id) => JSON.stringify(answers[id] ?? null) === JSON.stringify(saved[id] ?? null)))) {
      removeAnswerDraft(owner, work); restoredIds.current = [];
    }
  }, [answers, candidate, completed, owner, saved, work]);
  function discard() { removeAnswerDraft(owner, work); restoredIds.current = []; setCandidate(null); }
  return { candidate, compatible: candidate ? draftMatchesServer(candidate, work) : false, discard,
    restore: (change: (id: string, answer: AssessmentAnswer | null) => void) => {
      if (!candidate || !draftMatchesServer(candidate, work)) return;
      restoredIds.current = [...new Set([...Object.keys(candidate.answers), ...Object.keys(candidate.base)])];
      for (const id of restoredIds.current) change(id, candidate.answers[id] ?? null);
      setCandidate(null);
    },
  };
}
