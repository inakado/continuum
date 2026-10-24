"use client";
import { useState } from 'react';
import { ApiError } from '@/lib/api/client';
import { apiErrorMessage } from '@/lib/api/error-message';
import { useAuthSession } from '@/features/auth/useAuthSession';
import type { useSaveBeforeLeave } from '@/lib/navigation/use-save-before-leave';
import Dialog from '@/components/ui/Dialog';
import { useConfirmation } from '@/components/ui/useConfirmation';
import type { useWorkDraft } from './use-work-draft';
import WorkReauthenticate from './WorkReauthenticate';
import styles from './teacher-works.module.css';

export default function WorkSaveFeedback({ editor, leave, onReload }: { editor: ReturnType<typeof useWorkDraft>; leave: ReturnType<typeof useSaveBeforeLeave>; onReload: () => Promise<void> }) {
  const session = useAuthSession();
  const [principal] = useState(() => session.data?.user);
  const [signIn, setSignIn] = useState(false);
  const confirmation = useConfirmation();
  const conflict = editor.error instanceof ApiError && editor.error.status === 409;
  const expired = (editor.error instanceof ApiError && editor.error.status === 401) || session.data === null;
  const message = expired ? 'Сессия завершилась. Войдите, чтобы сохранить изменения.' : apiErrorMessage(editor.error, 'Не удалось сохранить работу. Проверьте соединение и повторите попытку.');
  const retry = expired ? <button className={styles.primary} onClick={() => setSignIn(true)}>Войти и сохранить</button> : <button className={styles.primary} disabled={conflict || editor.saving} onClick={() => leave.failed ? leave.decide('retry') : editor.retry()}>Повторить сохранение</button>;
  return <>
    {(editor.error || expired) && <div className={styles.error} role="alert"><p>{message}</p>{conflict ? <button className={styles.secondary} onClick={() => confirmation.ask({ title: 'Загрузить актуальную работу?', description: 'Несохранённые изменения этой вкладки будут заменены сохранённой версией.', confirmText: 'Загрузить работу', destructive: true }, onReload)}>Загрузить актуальную работу</button> : retry}</div>}
    <Dialog open={leave.failed && !signIn} onOpenChange={(open) => { if (!open) leave.decide('stay'); }} title="Изменения ещё не сохранены" description={conflict ? 'Работа изменена в другой вкладке. Останьтесь в редакторе, чтобы проверить актуальную версию, или выйдите без сохранения своего ввода.' : message} className={styles.workDialog} overlayClassName={styles.workOverlay}>
      <div className={styles.dialogActions}><button className={styles.secondary} onClick={() => leave.decide('stay')}>Остаться</button>{!conflict && retry}<button className={styles.textButton} onClick={() => leave.decide('discard')}>Выйти без сохранения</button></div>
    </Dialog>
    {signIn && principal && <WorkReauthenticate owner={principal.id} login={principal.login} onClose={() => setSignIn(false)} onReady={() => { setSignIn(false); if (leave.failed) leave.decide('retry'); else editor.retry(); }} />}
    {confirmation.dialog}
  </>;
}
