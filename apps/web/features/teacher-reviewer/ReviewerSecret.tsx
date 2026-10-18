"use client";
import { useState } from 'react';
import styles from './reviewer-access.module.css';

export default function ReviewerSecret({ secret, done }: { secret: string; done: () => void }) {
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');
  async function copy() {
    try { await navigator.clipboard.writeText(secret); setCopied(true); setError(''); }
    catch { setError('Не удалось скопировать. Выделите ключ и скопируйте вручную.'); }
  }
  return <section className={styles.form} aria-label="Ключ создан"><h2>Ключ создан</h2><p>Скопируйте его для подключения в терминале. После закрытия этот ключ больше не показывается.</p><label className={styles.field}>Ключ для подключения<input autoFocus readOnly value={secret} autoComplete="off" spellCheck={false} onFocus={(event) => event.target.select()} /></label><p className={styles.muted}>Вставьте ключ только в скрытый запрос команды подключения. Не отправляйте его агенту в чат и не сохраняйте в файлах проекта.</p><div className={styles.actions}><button type="button" className={styles.secondary} onClick={() => void copy()}>{copied ? 'Скопировано' : 'Скопировать ключ'}</button><button type="button" className={styles.primary} onClick={done}>Готово</button></div>{error && <p className={styles.error} role="alert">{error}</p>}</section>;
}
