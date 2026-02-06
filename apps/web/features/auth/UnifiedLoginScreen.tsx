"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import LandingTopology from "@/components/LandingTopology";
import { useTheme } from "@/components/useTheme";
import { teacherApi } from "@/lib/api/teacher";
import { ApiError } from "@/lib/api/client";
import styles from "./unified-login.module.css";

export default function UnifiedLoginScreen() {
  const router = useRouter();
  const { theme, toggle } = useTheme();
  const [started, setStarted] = useState(false);
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const formRef = useRef<HTMLDivElement | null>(null);
  const loginInputRef = useRef<HTMLInputElement | null>(null);

  const handleStart = () => {
    setStarted(true);
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  useEffect(() => {
    if (!started) return;
    // Avoid unexpected auto-focus on touch devices.
    if (!window.matchMedia("(pointer: fine)").matches) return;
    loginInputRef.current?.focus();
  }, [started]);

  const handleSubmit = async () => {
    setError(null);
    setLoading(true);
    try {
      const result = await teacherApi.login(login, password);
      const role = result.user?.role;
      if (role === "teacher") {
        router.push("/teacher");
      } else if (role === "student") {
        router.push("/student");
      } else {
        router.push("/");
      }
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setError("Неверный логин или пароль");
      } else if (err instanceof ApiError) {
        setError(err.message || "Ошибка входа");
      } else {
        setError("Ошибка входа");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`${styles.page} ${theme === "dark" ? styles.pageDark : styles.pageLight}`}>
      <LandingTopology theme={theme} className={styles.background} />
      <div className={styles.overlay} />
      <div className={styles.content}>
        <div className={styles.topBar}>
          <button
            className={styles.themeToggle}
            type="button"
            onClick={toggle}
            aria-label={theme === "dark" ? "Светлая тема" : "Тёмная тема"}
            aria-pressed={theme === "dark"}
          >
            {theme === "dark" ? (
              <svg viewBox="0 0 24 24" role="img" aria-hidden="true" className={styles.themeIcon}>
                <path
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 3v2m0 14v2m9-9h-2M5 12H3m14.95 6.95-1.4-1.4M6.45 6.45 5.05 5.05m12.9 0-1.4 1.4M6.45 17.55l-1.4 1.4M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z"
                />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" role="img" aria-hidden="true" className={styles.themeIcon}>
                <path
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M21 14.5A8.5 8.5 0 1 1 9.5 3a7 7 0 0 0 11.5 11.5Z"
                />
              </svg>
            )}
          </button>
        </div>

        <div className={styles.stage}>
          <section className={`${styles.hero} ${started ? styles.heroHidden : ""}`}>
            <div className={styles.heroTitle}>КОНТИНУУМ</div>
            <Button onClick={handleStart} className={styles.heroButton}>
              Начать обучение →
            </Button>
          </section>

          <section
            ref={formRef}
            className={`${styles.formSection} ${started ? styles.formVisible : ""}`}
          >
            <div className={styles.formTitle}>Вход</div>
            <div className={styles.card}>
              <label className={styles.label}>
                Логин
                <Input
                  ref={loginInputRef}
                  value={login}
                  onChange={(event) => setLogin(event.target.value)}
                  name="login"
                  autoComplete="username"
                  spellCheck={false}
                  placeholder="Например: teacher1 / student1…"
                />
              </label>
              <label className={styles.label}>
                Пароль
                <Input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  name="password"
                  autoComplete="current-password"
                  placeholder="Pass123!…"
                />
              </label>
              {error ? (
                <div className={styles.error} role="alert">
                  {error}
                </div>
              ) : null}
              <Button disabled={loading || !login || !password} onClick={handleSubmit}>
                {loading ? "Вход…" : "Войти"}
              </Button>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
