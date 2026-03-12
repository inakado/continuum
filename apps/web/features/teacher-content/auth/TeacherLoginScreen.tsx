"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import TeacherShell from "@/components/TeacherShell";
import { teacherApi } from "@/lib/api/teacher";
import { getApiErrorMessage } from "../shared/api-errors";
import styles from "./teacher-login.module.css";

export default function TeacherLoginScreen() {
  const router = useRouter();
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    setError(null);
    setLoading(true);
    try {
      await teacherApi.login(login, password);
      router.push("/teacher");
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <TeacherShell title="Вход" subtitle="Доступ преподавателя (dev)">
      <div className={styles.card}>
        <>
          <label className={styles.label}>
            Логин
            <Input
              value={login}
              onChange={(event) => setLogin(event.target.value)}
              placeholder="teacher1"
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
        </>
      </div>
    </TeacherShell>
  );
}
