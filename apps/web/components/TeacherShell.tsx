import Link from "next/link";
import type { ReactNode } from "react";
import styles from "./teacher-shell.module.css";
import Button from "./ui/Button";

type TeacherShellProps = {
  title: string;
  subtitle?: string;
  onLogout?: () => void;
  children: ReactNode;
};

export default function TeacherShell({ title, subtitle, onLogout, children }: TeacherShellProps) {
  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <header className={styles.header}>
          <div>
            <div className={styles.kicker}>Консоль преподавателя</div>
            <h1 className={styles.title}>{title}</h1>
            {subtitle ? <p className={styles.subtitle}>{subtitle}</p> : null}
          </div>
          <div className={styles.headerActions}>
            <Link className={styles.navLink} href="/teacher/courses">
              Курсы
            </Link>
            <Link className={styles.navLink} href="/teacher/events">
              События
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
