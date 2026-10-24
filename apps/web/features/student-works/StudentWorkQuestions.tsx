"use client";
import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { AssessmentAnswer, StudentWorkDetail, SolutionAnswer } from '@continuum/shared';
import AssessmentQuestions from '@/components/assessment/AssessmentQuestions';
export { assessmentAnswerState as studentAnswerState } from '@/components/assessment/AssessmentQuestions';

export default function StudentWorkQuestions({ work, answers, disabled, onChange, requestedTask, solutions = [], renderExtended, automaticCompleted = false, entry, solutionsLoading = false }: {
  work: StudentWorkDetail; answers: StudentWorkDetail['answers']; disabled: boolean;
  onChange: (id: string, answer: AssessmentAnswer) => void;
  requestedTask?: { id: string; request: number };
  solutions?: SolutionAnswer[]; renderExtended?: (id: string) => ReactNode; automaticCompleted?: boolean;
  entry?: 'solutions' | 'result'; solutionsLoading?: boolean;
}) {
  const [activeId, setActiveId] = useState(work.items[0]?.id ?? '');
  const positionKey = `continuum:work-position:${work.id}`;
  const pendingEntry = useRef(entry);
  useEffect(() => {
    try {
      const id = sessionStorage.getItem(positionKey);
      if (work.items.some((item) => item.id === id)) setActiveId(id!);
    } catch { /* Navigation still works when browser storage is unavailable. */ }
  }, [positionKey, work.items]);
  useEffect(() => {
    if (!pendingEntry.current || solutionsLoading) return;
    const intent = pendingEntry.current;
    const target = work.items.find((item) => item.type === 'extended' && (intent === 'solutions' ? !solutions.find((answer) => answer.taskId === item.id)?.photos.length : solutions.some((answer) => answer.taskId === item.id && answer.publishedReview)));
    pendingEntry.current = undefined;
    if (target) {
      setActiveId(target.id);
      try { sessionStorage.setItem(positionKey, target.id); } catch { /* Navigation also works without storage. */ }
    }
    const url = new URL(window.location.href);
    url.searchParams.delete('view');
    window.history.replaceState(null, '', url.pathname + url.search + url.hash);
  }, [positionKey, solutions, solutionsLoading, work.items]);
  useEffect(() => {
    if (!requestedTask || !work.items.some((item) => item.id === requestedTask.id)) return;
    setActiveId(requestedTask.id);
    try { sessionStorage.setItem(positionKey, requestedTask.id); } catch { /* Position is optional. */ }
  }, [positionKey, requestedTask, work.items]);
  function select(id: string) {
    setActiveId(id);
    try { sessionStorage.setItem(positionKey, id); } catch { /* Position is optional; answers are saved by the attempt hook. */ }
  }
  return <AssessmentQuestions items={work.items} answers={answers} activeId={activeId} onSelect={select} onChange={onChange} disabled={disabled} automaticCompleted={automaticCompleted} photoTaskIds={solutions.filter((answer) => answer.photos.length).map((answer) => answer.taskId)} renderExtended={renderExtended} focusRequest={requestedTask?.request} />;
}
