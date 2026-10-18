"use client";
import type { StudentWorkDetail } from '@continuum/shared';
import Dialog from '@/components/ui/Dialog';
import { studentAnswerState } from './StudentWorkQuestions';
import styles from './student-works.module.css';

export default function StudentFinishReview({ open, close, work, answers, disabled, onTask, onFinish }: {
  open: boolean; close: () => void; work: StudentWorkDetail; answers: StudentWorkDetail['answers']; disabled: boolean; onTask: (id: string) => void; onFinish: () => void;
}) {
  const automatic = work.items.filter((item) => item.type !== 'extended');
  const mixed = automatic.length !== work.items.length;
  const missing = open ? work.items.map((item, index) => ({ item, index, state: studentAnswerState(item, answers[item.id]) })).filter((row) => row.item.type !== 'extended' && row.state !== 'filled') : [];
  return <Dialog open={open} onOpenChange={(value) => { if (!value) close(); }} title={mixed ? 'Завершить тестовую часть?' : 'Завершить работу?'} description={mixed ? 'Тестовые ответы изменить будет нельзя. Фотографии решений можно добавлять позже.' : 'После завершения ответы изменить нельзя.'} className={styles.workDialog}>
    <p className={styles.reviewSummary}>Заполнено: {automatic.length - missing.length} из {automatic.length}</p>
    {missing.length > 0 && <><p>Проверьте задания:</p><ul className={styles.missingTasks}>{missing.map(({ item, index, state }) => <li key={item.id}><button className={styles.textButton} onClick={() => { onTask(item.id); close(); }}>Задание {index + 1} — {state === 'partial' ? 'ответ не закончен' : 'без ответа'}</button></li>)}</ul></>}
    <div className={styles.dialogActions}><button className={styles.secondary} onClick={close}>Вернуться к работе</button><button className={styles.primary} disabled={disabled} onClick={() => { close(); onFinish(); }}>{missing.length ? 'Завершить с пропусками' : 'Подтвердить завершение'}</button></div>
  </Dialog>;
}
