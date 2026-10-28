"use client";

import { useEffect, useReducer, useRef } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from '@tanstack/react-query';
import { authQueryKeys } from '@/lib/query/keys';
import { clearAnswerDrafts } from '@/lib/assessment/answer-draft';
import Input from "@/components/ui/Input";
import IridescenceBackdrop from "./IridescenceBackdrop";
import { useTheme } from "@/components/useTheme";
import { authApi } from "@/lib/auth/client";
import { ApiError } from "@/lib/api/client";
import { Eye, EyeOff } from "lucide-react";
import styles from "./unified-login.module.css";

export default function UnifiedLoginScreen() {
  const router = useRouter();
  const cache = useQueryClient();
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
      const result = await authApi.signIn(state.login, state.password);
      cache.clear();
      cache.setQueryData(authQueryKeys.session(), result);
      clearAnswerDrafts(result.user.id);
      const role = result.user?.role;
      if (role === "admin") {
        router.replace("/admin");
      } else if (role === "teacher") {
        router.replace("/teacher");
      } else if (role === "student") {
        const returnTo = new URLSearchParams(window.location.search).get('returnTo');
        router.replace(returnTo && /^\/student\/works\/[0-9a-f-]{36}$/i.test(returnTo) ? returnTo : '/student');
      } else {
        router.replace("/");
      }
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        dispatch({ type: "error", value: "Неверный логин или пароль" });
      } else {
        dispatch({ type: "error", value: "Не удалось войти. Попробуйте ещё раз." });
      }
    } finally {
      dispatch({ type: "loading", value: false });
    }
  };

  return (
    <div
      className={`${styles.page} ${theme === "dark" ? styles.pageDark : styles.pageLight} glass-scope`}
    >
      <IridescenceBackdrop />
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
