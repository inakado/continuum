import { buildPageMetadata } from "@/app/page-metadata";
import ContinuumHeader from "@/components/ContinuumHeader";
import styles from "./admin.module.css";

export const metadata = buildPageMetadata(
  "Администрирование",
  "Системные настройки Континуума.",
);

export default function AdminPage() {
  return (
    <div className={styles.page}>
      <ContinuumHeader homeHref="/admin" />
      <main className={styles.main}>
        <h1>Управление преподавателями</h1>
        <p>Раздел пока не подключён.</p>
      </main>
    </div>
  );
}
