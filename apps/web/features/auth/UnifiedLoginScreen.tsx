"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Input from "@/components/ui/Input";
import Grainient from "@/components/Grainient";
import { useTheme } from "@/components/useTheme";
import { teacherApi } from "@/lib/api/teacher";
import { ApiError } from "@/lib/api/client";
import { Eye, EyeOff } from "lucide-react";
import styles from "./unified-login.module.css";

export default function UnifiedLoginScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const loginInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    // Avoid unexpected auto-focus on touch devices.
    if (!window.matchMedia("(pointer: fine)").matches) return;
    loginInputRef.current?.focus();
  }, []);

  const handleSubmit = async (event?: React.FormEvent<HTMLFormElement>) => {
    event?.preventDefault();
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
    <div
      className={`${styles.page} ${theme === "dark" ? styles.pageDark : styles.pageLight} glass-scope`}
    >
      <div className={styles.background} aria-hidden="true">
        <Grainient
          color1="#000000"
          color2="#ffffff"
          color3="#000000"
          timeSpeed={0.25}
          colorBalance={0}
          warpStrength={4}
          warpFrequency={12}
          warpSpeed={2}
          warpAmplitude={45}
          blendAngle={86}
          blendSoftness={0.2}
          rotationAmount={500}
          noiseScale={2.15}
          grainAmount={0.15}
          grainScale={1.2}
          grainAnimated={false}
          contrast={1.55}
          gamma={1.3}
          saturation={1}
          centerX={0.01}
          centerY={0}
          zoom={1}
        />
      </div>
      <div className={styles.scrim} aria-hidden="true" />
      <div className={styles.center}>
        <div className={styles.brand}>Континуум</div>
        <form className={styles.form} onSubmit={handleSubmit}>
          <Input
            ref={loginInputRef}
            className={styles.formInput}
            placeholder="Логин"
            name="login"
            autoComplete="username"
            spellCheck={false}
            value={login}
            onChange={(event) => setLogin(event.target.value)}
            aria-label="Логин"
          />
          <div className={styles.inputWrap}>
            <Input
              className={styles.formInput}
              placeholder="Пароль"
              name="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              aria-label="Пароль"
            />
            <button
              type="button"
              className={styles.revealButton}
              onClick={() => setShowPassword((prev) => !prev)}
              aria-label={showPassword ? "Скрыть пароль" : "Показать пароль"}
              aria-pressed={showPassword}
            >
              {showPassword ? <EyeOff size={16} strokeWidth={1.6} /> : <Eye size={16} strokeWidth={1.6} />}
            </button>
          </div>
          {error ? (
            <div className={styles.error} role="alert">
              {error}
            </div>
          ) : null}
          <button
            type="submit"
            className={styles.submitButton}
            disabled={loading || !login || !password}
          >
            {loading ? "Вход…" : "Войти"}
          </button>
        </form>
      </div>
    </div>
  );
}
