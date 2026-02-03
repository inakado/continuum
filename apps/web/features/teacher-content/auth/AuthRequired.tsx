"use client";

import Link from "next/link";
import styles from "./auth-required.module.css";
import Button from "@/components/ui/Button";

export default function AuthRequired() {
  return (
    <div className={styles.wrapper}>
      <div className={styles.card}>
        <div className={styles.title}>Нужна авторизация</div>
        <p className={styles.text}>Сессия не найдена. Перелогиньтесь, чтобы продолжить.</p>
        <Link href="/login">
          <Button>Войти</Button>
        </Link>
      </div>
    </div>
  );
}
