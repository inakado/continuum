"use client";

import styles from "./student-not-found.module.css";

type StudentNotFoundProps = {
  title?: string;
  description?: string;
};

export default function StudentNotFound({
  title = "Не найдено",
  description = "Не найдено или недоступно",
}: StudentNotFoundProps) {
  return (
    <div className={styles.wrapper}>
      <div className={styles.title}>{title}</div>
      <p className={styles.text}>{description}</p>
    </div>
  );
}
