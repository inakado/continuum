import Link from "next/link";
import styles from "./error-page.module.css";

export default function NotFound() {
  return (
    <main className={styles.page}>
      <p className={styles.brand}>Континуум</p>
      <h1>Страница не найдена</h1>
      <p>Проверьте адрес или вернитесь ко входу.</p>
      <Link href="/login">Ко входу</Link>
    </main>
  );
}
