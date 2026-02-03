"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import LandingTopology from "@/components/LandingTopology";
import { teacherApi } from "@/lib/api/teacher";
import { ApiError } from "@/lib/api/client";
import styles from "./unified-login.module.css";

export default function UnifiedLoginScreen() {
  const router = useRouter();
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [manualTheme, setManualTheme] = useState<"light" | "dark" | null>(null);
  const [started, setStarted] = useState(false);
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const formRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const saved = window.localStorage.getItem("continuum-theme");
    if (saved === "light" || saved === "dark") {
      setTheme(saved);
      setManualTheme(saved);
      return;
    }

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const update = () => {
      if (manualTheme) return;
      setTheme(media.matches ? "dark" : "light");
    };
    update();
    if (media.addEventListener) {
      media.addEventListener("change", update);
      return () => media.removeEventListener("change", update);
    }
    media.addListener(update);
    return () => media.removeListener(update);
  }, [manualTheme]);

  const handleThemeToggle = () => {
    const nextTheme = theme === "dark" ? "light" : "dark";
    setTheme(nextTheme);
    setManualTheme(nextTheme);
    window.localStorage.setItem("continuum-theme", nextTheme);
  };

  const handleStart = () => {
    setStarted(true);
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  const handleSubmit = async () => {
    setError(null);
    setLoading(true);
    try {
      const result = await teacherApi.login(login, password);
      const role = result.user?.role;
      if (role === "teacher") {
        router.push("/teacher/courses");
      } else if (role === "student") {
        router.push("/student/courses");
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
            onClick={handleThemeToggle}
            aria-label={theme === "dark" ? "Светлая тема" : "Тёмная тема"}
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
                  value={login}
                  onChange={(event) => setLogin(event.target.value)}
                  placeholder="teacher1 / student1"
                  autoFocus={started}
                />
              </label>
              <label className={styles.label}>
                Пароль
                <Input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Pass123!"
                />
              </label>
              {error ? <div className={styles.error}>{error}</div> : null}
              <Button disabled={loading || !login || !password} onClick={handleSubmit}>
                {loading ? "Вход..." : "Войти"}
              </Button>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
