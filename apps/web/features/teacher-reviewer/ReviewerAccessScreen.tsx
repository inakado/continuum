"use client";
import { useState } from 'react';
import TeacherChrome from '@/features/teacher-shell/TeacherChrome';
import { apiErrorMessage } from '@/lib/api/error-message';
import { keyStatus, targetSummary } from './reviewer-labels';
import { useReviewerAccess, useReviewerKeyCreation } from './use-reviewer-access';
import ReviewerKeyForm from './ReviewerKeyForm';
import ReviewerSecret from './ReviewerSecret';
import styles from './reviewer-access.module.css';
import { useConfirmation } from '@/components/ui/useConfirmation';

export default function ReviewerAccessScreen() {
  const confirmation = useConfirmation();
  const { keys, targets, revoke } = useReviewerAccess();
  const creation = useReviewerKeyCreation();
  const [creating, setCreating] = useState(false);
  function closeCreation() { creation.clear(); setCreating(false); }
  const ready = !targets.isPending && !targets.error;
  return <div className={styles.page}>
    <TeacherChrome beforeLogout={async () => { closeCreation(); return true; }} />
    <main className={styles.main}>
      <div className={styles.heading}><h1>Подключение агента</h1>{!creating && !creation.secret && <button type="button" className={styles.primary} disabled={!ready} onClick={() => setCreating(true)}>Подключить компьютер</button>}</div>
      {targets.isPending && <p role="status">Загружаем классы и учеников…</p>}
      {targets.error && <div role="alert"><p>{apiErrorMessage(targets.error)}</p><button className={styles.textButton} onClick={() => void targets.refetch()}>Повторить</button></div>}
      {creation.secret ? <ReviewerSecret secret={creation.secret} done={closeCreation} /> : creating && targets.data && <ReviewerKeyForm targets={targets.data} busy={creation.busy} submit={creation.create} cancel={closeCreation} />}
      {creation.error && <div className={styles.error} role="alert"><p>{creation.error}</p><p>Если запрос прервался, проверьте список компьютеров. Ключ без сохранённого секрета нужно отозвать и создать заново.</p></div>}
      <section className={styles.section} aria-label="Подключённые компьютеры">
        {keys.isPending && <p role="status">Загружаем подключения…</p>}
        {keys.error && <div role="alert"><p>{apiErrorMessage(keys.error)}</p><button className={styles.textButton} onClick={() => void keys.refetch()}>Повторить</button></div>}
        {revoke.error && <p className={styles.error} role="alert">{apiErrorMessage(revoke.error)}</p>}
        {keys.data && !keys.data.length && <p className={styles.muted}>Нет подключённых компьютеров. Для каждого устройства создайте отдельный ключ.</p>}
        <ul className={styles.list}>{keys.data?.map((key) => <li key={key.id}><div className={styles.keyDetails}><strong>{key.name}</strong><p>{targetSummary(key, targets.data)}</p><p className={styles.muted}>{keyStatus(key)}</p></div>{!key.revokedAt && <button type="button" className={styles.danger} disabled={revoke.isPending} onClick={() => confirmation.ask({ title: 'Отозвать ключ?', description: `«${key.name}»: агент на этом компьютере потеряет доступ. Для повторного подключения потребуется новый ключ.`, confirmText: 'Отозвать ключ', destructive: true }, () => revoke.mutateAsync(key.id))}>Отозвать</button>}</li>)}</ul>
      </section>
      <details className={styles.instructions}><summary>Как подключить компьютер</summary><p>Запустите локальный клиент по инструкции и вставьте ключ в скрытый запрос терминала. Он сохранится в «Связке ключей» macOS. Затем давайте агенту задания в чате — без передачи ключа.</p></details>
    </main>
    {confirmation.dialog}
  </div>;
}
