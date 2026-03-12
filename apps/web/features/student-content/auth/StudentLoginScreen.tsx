"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import StudentShell from "@/components/StudentShell";
import { studentApi } from "@/lib/api/student";
import { ApiError } from "@/lib/api/client";
import styles from "./student-login.module.css";

export default function StudentLoginScreen() {
  const router = useRouter();
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    setError(null);
    setLoading(true);
    try {
      await studentApi.login(login, password);
      router.push("/student/courses");
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
    <StudentShell title="Вход" subtitle="Доступ ученика (dev)">
      <div className={styles.card}>
        <label className={styles.label}>
          Логин
          <Input
            value={login}
            onChange={(event) => setLogin(event.target.value)}
            placeholder="student1"
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
    </StudentShell>
  );
}
