"use client";

import { useTheme } from "@/components/useTheme";
import styles from "./theme-toggle.module.css";

type ThemeToggleProps = {
  compact?: boolean;
};

export default function ThemeToggle({ compact = false }: ThemeToggleProps) {
  const { theme, toggle } = useTheme();

  return (
    <button
      type="button"
      className={`${styles.toggle} ${compact ? styles.compact : ""}`}
      onClick={toggle}
      aria-label={theme === "dark" ? "Светлая тема" : "Тёмная тема"}
      title={theme === "dark" ? "Светлая тема" : "Тёмная тема"}
    >
      {theme === "dark" ? (
        <svg viewBox="0 0 24 24" role="img" aria-hidden="true" className={styles.icon}>
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
        <svg viewBox="0 0 24 24" role="img" aria-hidden="true" className={styles.icon}>
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
  );
}
