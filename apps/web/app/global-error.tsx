"use client";

import styles from "./error-page.module.css";

export default function GlobalError({
  error: _error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="ru">
      <body>
        <main className={styles.page}>
          <p className={styles.brand}>Континуум</p>
          <h1>Сервис временно недоступен</h1>
          <p>Попробуйте ещё раз.</p>
          <button type="button" onClick={() => reset()}>
            Повторить
          </button>
        </main>
      </body>
    </html>
  );
}
