"use client";

import styles from "./error-page.module.css";

export default function Error({
  error: _error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className={styles.page}>
      <p className={styles.brand}>Континуум</p>
      <h1>Не удалось открыть страницу</h1>
      <p>Попробуйте ещё раз.</p>
      <button type="button" onClick={() => reset()}>
        Повторить
      </button>
    </main>
  );
}
