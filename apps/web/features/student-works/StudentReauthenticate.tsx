"use client";
import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { authApi } from '@/lib/auth/client';
import { authQueryKeys } from '@/lib/query/keys';
import { ApiError } from '@/lib/api/client';
import Dialog from '@/components/ui/Dialog';
import styles from './student-works.module.css';

export default function StudentReauthenticate({ owner, login, onReady }: { owner: string; login: string; onReady: () => void }) {
  const cache = useQueryClient();
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  return <Dialog open onOpenChange={() => {}} title="Войдите, чтобы сохранить ответы" description="Сессия завершилась. Ваш ввод остаётся в этой вкладке." className={styles.workDialog}>
    <form className={styles.reauth} onSubmit={(event) => {
      event.preventDefault(); setBusy(true); setError('');
      void (async () => {
        try {
          const session = await authApi.signIn(login, password);
          if (session.user.id !== owner || session.user.role !== 'student') { await authApi.signOut(); throw new Error('ACCOUNT_CHANGED'); }
          cache.setQueryData(authQueryKeys.session(), session);
          onReady();
        } catch (reason) { setError(reason instanceof ApiError && reason.status === 401 ? 'Неверный пароль.' : 'Не удалось восстановить вход. Попробуйте ещё раз.'); }
        finally { setPassword(''); setBusy(false); }
      })();
    }}>
      <label>Логин<input autoComplete="username" value={login} readOnly /></label>
      <label>Пароль<input aria-label="Пароль для продолжения работы" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} /></label>
      {error && <p role="alert" className={styles.error}>{error}</p>}
      <button className={styles.primary} disabled={busy || !password}>{busy ? 'Входим…' : 'Войти и продолжить'}</button>
    </form>
  </Dialog>;
}
