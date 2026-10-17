"use client";
import Dialog from '@/components/ui/Dialog';
import styles from './student-works.module.css';

export default function StudentLeaveDialog({ open, decide }: { open: boolean; decide: (value: 'stay' | 'retry' | 'discard') => void }) {
  return <Dialog open={open} onOpenChange={(value) => { if (!value) decide('stay'); }} title="Ответы ещё не сохранены" description="Соединение или вход требуют внимания. Можно остаться в работе либо повторить сохранение." className={styles.workDialog}>
    <div className={styles.dialogActions}>
      <button className={styles.secondary} onClick={() => decide('stay')}>Остаться</button>
      <button className={styles.primary} onClick={() => decide('retry')}>Повторить и выйти</button>
      <button className={styles.textButton} onClick={() => decide('discard')}>Выйти без сохранения</button>
    </div>
  </Dialog>;
}
