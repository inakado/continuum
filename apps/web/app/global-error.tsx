"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="ru">
      <body>
        <main>
          <h1>Ошибка</h1>
          <p>Произошла критическая ошибка.</p>
          <button type="button" onClick={() => reset()}>
            Попробовать снова
          </button>
        </main>
      </body>
    </html>
  );
}
