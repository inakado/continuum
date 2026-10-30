"use client";
import { useEffect, useRef, type RefObject } from 'react';
import type { StudentWorkDetail } from '@continuum/shared';
import Dialog from '@/components/ui/Dialog';
import { studentAnswerState } from './StudentWorkQuestions';
import styles from './student-works.module.css';

export default function StudentFinishReview({ open, close, work, answers, disabled, onTask, onFinish, returnFocus }: {
  returnFocus?: RefObject<HTMLButtonElement | null>; open: boolean; close: () => void; work: StudentWorkDetail; answers: StudentWorkDetail['answers']; disabled: boolean; onTask: (id: string) => void; onFinish: () => void;
}) {
  const chosen = useRef(false);
  useEffect(() => { if (open) chosen.current = false; }, [open]);
  const automatic = work.items.filter((item) => item.type !== 'extended');
  const mixed = automatic.length !== work.items.length;
  const missing = open ? work.items.map((item, index) => ({ item, index, state: studentAnswerState(item, answers[item.id]) })).filter((row) => row.item.type !== 'extended' && row.state !== 'filled') : [];
  return <Dialog open={open} onOpenChange={(value) => { if (!value) close(); }} title={mixed ? 'Завершить тестовую часть?' : 'Завершить работу?'} description={mixed ? 'Тестовые ответы изменить будет нельзя. Фотографии решений можно добавлять позже.' : 'После завершения ответы изменить нельзя.'} className={styles.workDialog} onCloseAutoFocus={event => { if (chosen.current) event.preventDefault(); else if (returnFocus?.current?.isConnected) { event.preventDefault(); returnFocus.current.focus({ preventScroll: true }); } }}>
    <div className={styles.reviewBody}><p className={styles.reviewSummary}>Заполнено: {automatic.length - missing.length} из {automatic.length}</p>
    {missing.length > 0 && <><p>Проверьте задания:</p><ul className={styles.missingTasks}>{missing.map(({ item, index, state }) => <li key={item.id}><button className={styles.textButton} aria-label={`Задание ${index + 1} — ${state === 'partial' ? 'ответ не закончен' : 'без ответа'}`} data-state={state} onClick={() => { chosen.current = true; onTask(item.id); close(); }}><span className={styles.missingPrefix}>Задание </span>{index + 1}<span className={styles.missingSuffix}> — {state === 'partial' ? 'ответ не закончен' : 'без ответа'}</span></button></li>)}</ul></>}
    </div><div className={styles.dialogActions}><button className={styles.secondary} onClick={close}>Вернуться к работе</button><button className={styles.primary} disabled={disabled} onClick={() => { close(); onFinish(); }}>{missing.length ? 'Завершить с пропусками' : 'Подтвердить завершение'}</button></div>
  </Dialog>;
}
