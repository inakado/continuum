'use client';

import { useEffect, useRef, useState, type SyntheticEvent } from 'react';
import { Check, X } from 'lucide-react';
import { lessonReadingTop, useLessonEnvironment } from '@/components/interactive-lesson/authoring/LessonEnvironment';
import styles from './reading-question.module.css';

type AnswerResult = 'correct' | 'incorrect';

function useReadingQuestion(questionId: string, storageKey?: string) {
  const environment = useLessonEnvironment();
  const anchor = useRef<HTMLSpanElement>(null);
  const sheet = useRef<HTMLElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  const offered = useRef(false);
  const [phase, setPhase] = useState<'closed' | 'open' | 'closing'>('closed');
  const open = phase === 'open';
  const [result, setResult] = useState<AnswerResult | null>(null);

  useEffect(() => {
    try {
      const saved = environment ? environment.state.answers[questionId] : storageKey ? localStorage.getItem(storageKey) : null;
      if (saved === 'correct' || saved === 'incorrect') {
        setResult(saved);
        return;
      }
    } catch { /* При недоступном хранилище вопрос работает в текущей вкладке. */ }
    let timer: ReturnType<typeof setTimeout>;
    const schedule = () => {
      clearTimeout(timer);
      if (offered.current) return;
      timer = setTimeout(() => {
        const top = anchor.current?.getBoundingClientRect().top;
        const readingTop = lessonReadingTop();
        if (top !== undefined && top >= readingTop && top < window.innerHeight * .75) {
          offered.current = true;
          returnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
          setPhase('open');
        }
      }, 600);
    };
    // Wheel учитывает попытку пролистывания, когда короткий текст целиком помещается в окно.
    const onWheel = (event: WheelEvent) => { if (!event.ctrlKey && Math.abs(event.deltaY) > Math.abs(event.deltaX)) schedule(); };
    const onReadingKey = (event: KeyboardEvent) => {
      if (event.defaultPrevented || !['ArrowDown', 'PageDown', 'End', ' '].includes(event.key)) return;
      if (event.target instanceof HTMLElement && event.target.closest('input, textarea, select, button, [contenteditable="true"]')) return;
      schedule();
    };
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('wheel', onWheel, { passive: true });
    window.addEventListener('keydown', onReadingKey);
    return () => { clearTimeout(timer); window.removeEventListener('scroll', schedule); window.removeEventListener('wheel', onWheel); window.removeEventListener('keydown', onReadingKey); };
  }, []);

  function dismiss() {
    if (sheet.current?.contains(document.activeElement)) {
      const readingTop = lessonReadingTop();
      const visible = (node: HTMLElement) => {
        const box = node.getBoundingClientRect();
        return node.isConnected && box.bottom > readingTop && box.top < innerHeight && !sheet.current?.contains(node);
      };
      const previous = returnFocus.current;
      const target = previous && previous !== document.body && visible(previous) ? previous
        : [...(anchor.current?.closest('article') ?? document).querySelectorAll<HTMLElement>('p, h1, h2, h3, figure')].find(visible);
      if (target) {
        if (!target.hasAttribute('tabindex') && !target.matches('a[href], button, input, select, textarea')) {
          target.setAttribute('tabindex', '-1');
          target.addEventListener('blur', () => target.removeAttribute('tabindex'), { once: true });
        }
        target.focus({ preventScroll: true });
      } else anchor.current?.closest('article')?.querySelector<HTMLElement>('[tabindex], h1, p')?.focus({ preventScroll: true });
    }
    setPhase(matchMedia('(prefers-reduced-motion: reduce)').matches ? 'closed' : 'closing');
  }

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        dismiss();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open]);

  useEffect(() => {
    if (!open || result !== 'correct') return;
    const timer = setTimeout(dismiss, 1600);
    return () => clearTimeout(timer);
  }, [open, result]);

  function finishClosing() { setPhase(current => current === 'closing' ? 'closed' : current); }
  function complete(answerResult: AnswerResult) {
    setResult(answerResult);
    try { if (environment) environment.saveAnswer(questionId, answerResult);
      else if (storageKey) localStorage.setItem(storageKey, answerResult); }
    catch { /* Подтверждение сохраняется в памяти, если localStorage недоступен. */ }
  }

  return { anchor, sheet, open, phase, result, dismiss, complete, finishClosing };
}

export default function ReadingQuestion({ id, title, answer: expectedAnswer, explanation, prototypeStorageKey }: {
  id: string; title: string; answer: string; explanation: string; prototypeStorageKey?: string;
}) {
  const question = useReadingQuestion(id, prototypeStorageKey);
  const [answer, setAnswer] = useState('');
  const close = useRef<HTMLButtonElement>(null);

  function check(event: SyntheticEvent) {
    event.preventDefault();
    if (!answer.trim()) return;
    close.current?.focus({ preventScroll: true });
    question.complete(answer.trim().toLocaleLowerCase('ru-RU') === expectedAnswer.trim().toLocaleLowerCase('ru-RU') ? 'correct' : 'incorrect');
  }

  return (
    <>
      <span ref={question.anchor} className={styles.questionAnchor} aria-hidden="true" />
      {question.phase !== 'closed' && <section ref={question.sheet} id={`${id}-question`} data-reading-question className={styles.questionSheet} data-state={question.phase} data-result={question.result ?? undefined} aria-hidden={!question.open || undefined} inert={!question.open} aria-labelledby={`${id}-question-title`} onAnimationEnd={event => { if (event.target === event.currentTarget) question.finishClosing(); }}>
        <button ref={close} className={styles.questionClose} onClick={question.dismiss} type="button" aria-label="Закрыть вопрос"><X size={20} aria-hidden="true" /></button>
        <h2 id={`${id}-question-title`} className={question.result ? styles.srOnly : undefined}>{title}</h2>
        {!question.result && <form onSubmit={check}>
          <label htmlFor={`${id}-answer`} className={styles.srOnly}>Ваш ответ</label>
          <div className={styles.answerRow}>
            <input id={`${id}-answer`} value={answer} onChange={event => setAnswer(event.target.value)} onKeyDown={event => { if (event.key === 'Enter' && !event.nativeEvent.isComposing) check(event); }} placeholder="Ваш ответ" autoComplete="off" spellCheck={false} />
            <button className={styles.questionSubmit} disabled={!answer.trim()} type="button" onClick={check}>Проверить</button>
          </div>
        </form>}
        <div className={styles.questionFeedback} aria-live="polite">
          {question.result === 'correct' ? <div className={styles.questionCorrect}><Check size={18} aria-hidden="true" />Верно</div> : question.result === 'incorrect' ? <div id={`${id}-question-feedback`} className={styles.questionIncorrect}>Неверно. {explanation}</div> : null}
        </div>
      </section>}
    </>
  );
}
