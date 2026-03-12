"use client";

import { memo, useEffect, useReducer, useRef } from "react";
import { useRouter } from "next/navigation";
import Input from "@/components/ui/Input";
import Grainient from "@/components/Grainient";
import { useTheme } from "@/components/useTheme";
import { teacherApi } from "@/lib/api/teacher";
import { ApiError } from "@/lib/api/client";
import { Eye, EyeOff } from "lucide-react";
import styles from "./unified-login.module.css";

const GrainientBackdrop = memo(function GrainientBackdrop() {
  return (
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
  );
});

export default function UnifiedLoginScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const loginInputRef = useRef<HTMLInputElement | null>(null);
  const [state, dispatch] = useReducer(
    (
      current: {
        login: string;
        password: string;
        showPassword: boolean;
        error: string | null;
        loading: boolean;
      },
      action:
        | { type: "login"; value: string }
        | { type: "password"; value: string }
        | { type: "show-password/toggle" }
        | { type: "error"; value: string | null }
        | { type: "loading"; value: boolean },
    ) => {
      switch (action.type) {
        case "login":
          return { ...current, login: action.value };
        case "password":
          return { ...current, password: action.value };
        case "show-password/toggle":
          return { ...current, showPassword: !current.showPassword };
        case "error":
          return { ...current, error: action.value };
        case "loading":
          return { ...current, loading: action.value };
        default:
          return current;
      }
    },
    {
      login: "",
      password: "",
      showPassword: false,
      error: null,
      loading: false,
    },
  );

  useEffect(() => {
    // Avoid unexpected auto-focus on touch devices.
    if (!window.matchMedia("(pointer: fine)").matches) return;
    loginInputRef.current?.focus();
  }, []);

  const handleSubmit = async (event?: React.FormEvent<HTMLFormElement>) => {
    event?.preventDefault();
    dispatch({ type: "error", value: null });
    dispatch({ type: "loading", value: true });
    try {
      const result = await teacherApi.login(state.login, state.password);
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
        dispatch({ type: "error", value: "Неверный логин или пароль" });
      } else if (err instanceof ApiError) {
        dispatch({ type: "error", value: err.message || "Ошибка входа" });
      } else {
        dispatch({ type: "error", value: "Ошибка входа" });
      }
    } finally {
      dispatch({ type: "loading", value: false });
    }
  };

  return (
    <div
      className={`${styles.page} ${theme === "dark" ? styles.pageDark : styles.pageLight} glass-scope`}
    >
      <GrainientBackdrop />
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
            value={state.login}
            onChange={(event) => dispatch({ type: "login", value: event.target.value })}
            aria-label="Логин"
          />
          <div className={styles.inputWrap}>
            <Input
              className={styles.formInput}
              placeholder="Пароль"
              name="password"
              type={state.showPassword ? "text" : "password"}
              autoComplete="current-password"
              value={state.password}
              onChange={(event) => dispatch({ type: "password", value: event.target.value })}
              aria-label="Пароль"
            />
            <button
              type="button"
              className={styles.revealButton}
              onClick={() => dispatch({ type: "show-password/toggle" })}
              aria-label={state.showPassword ? "Скрыть пароль" : "Показать пароль"}
              aria-pressed={state.showPassword}
            >
              {state.showPassword ? <EyeOff size={16} strokeWidth={1.6} /> : <Eye size={16} strokeWidth={1.6} />}
            </button>
          </div>
          {state.error ? (
            <div className={styles.error} role="alert">
              {state.error}
            </div>
          ) : null}
          <button
            type="submit"
            className={styles.submitButton}
            disabled={state.loading || !state.login || !state.password}
          >
            {state.loading ? "Вход…" : "Войти"}
          </button>
        </form>
      </div>
    </div>
  );
}
