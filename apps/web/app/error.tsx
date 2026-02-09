"use client";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main>
      <h1>Ошибка</h1>
      <p>Что-то пошло не так.</p>
      <button type="button" onClick={() => reset()}>
        Попробовать снова
      </button>
    </main>
  );
}
