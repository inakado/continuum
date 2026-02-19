"use client";

import Link from "next/link";
import styles from "./student-auth-required.module.css";

export default function StudentAuthRequired() {
  return (
    <div className={styles.wrapper}>
      <div className={styles.card}>
        <div className={styles.title}>Нужна авторизация</div>
        <p className={styles.text}>Сессия не найдена. Перелогиньтесь, чтобы продолжить.</p>
        <Link href="/login" className={styles.loginLink}>
          Войти
        </Link>
      </div>
    </div>
  );
}
