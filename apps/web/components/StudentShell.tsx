import Link from "next/link";
import type { ReactNode } from "react";
import Button from "./ui/Button";
import styles from "./student-shell.module.css";

type StudentShellProps = {
  title: string;
  subtitle?: string;
  onLogout?: () => void;
  children: ReactNode;
};

export default function StudentShell({ title, subtitle, onLogout, children }: StudentShellProps) {
  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <header className={styles.header}>
          <div>
            <div className={styles.kicker}>Кабинет ученика</div>
            <h1 className={styles.title}>{title}</h1>
            {subtitle ? <p className={styles.subtitle}>{subtitle}</p> : null}
          </div>
          <div className={styles.headerActions}>
            <Link className={styles.navLink} href="/student">
              Панель
            </Link>
            {onLogout ? (
              <Button variant="ghost" onClick={onLogout}>
                Выйти
              </Button>
            ) : null}
          </div>
        </header>
        <main className={styles.main}>{children}</main>
      </div>
    </div>
  );
}
