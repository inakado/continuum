"use client";

import { ChevronDown, ChevronUp } from "lucide-react";
import { useEffect, useId, useState } from "react";
import styles from "../student-unit-detail.module.css";

export const UNIT_CONTEXT_COLLAPSED_STORAGE_KEY = "continuum-student-unit-context-collapsed";

type Props = {
  title: string;
  description?: string | null;
  showProgress: boolean;
  completionMeter: number;
  requiredDone: number;
  requiredTotal: number;
  solvedTasks: number;
  totalTasks: number;
};

function StudentUnitProgressCard({
  completionMeter,
  requiredDone,
  requiredTotal,
  solvedTasks,
  totalTasks,
}: Omit<Props, "title" | "description" | "showProgress">) {
  return (
    <section className={styles.progressCard} aria-label="Прогресс юнита">
      <div className={styles.progressLeadRow}>
        <div className={styles.progressLead}>
          <span className={styles.progressStatLabel}>Прогресс юнита</span>
          <span className={styles.progressLeadValue}>{completionMeter}%</span>
        </div>

        <div className={styles.progressSummary} aria-label="Сводка метрик">
          <article className={styles.progressSummaryItem}>
            <span className={styles.progressSummaryLabel}>Решено</span>
            <span className={styles.progressSummaryValue}>
              {solvedTasks}/{totalTasks} задач
            </span>
          </article>
          <div className={styles.progressSummaryDivider} aria-hidden="true" />
          <article className={styles.progressSummaryItem}>
            <span className={styles.progressSummaryLabel}>Ключевые</span>
            <span className={styles.progressSummaryValue}>
              {requiredDone}/{requiredTotal} задач
            </span>
          </article>
        </div>
      </div>

      <div className={styles.progressTrack} aria-hidden="true">
        <span className={styles.progressTrackFill} style={{ width: `${completionMeter}%` }} />
      </div>
    </section>
  );
}

export function StudentUnitContextPanel({
  title,
  description,
  showProgress,
  completionMeter,
  requiredDone,
  requiredTotal,
  solvedTasks,
  totalTasks,
}: Props) {
  const contentId = useId();
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const stored = window.localStorage.getItem(UNIT_CONTEXT_COLLAPSED_STORAGE_KEY);
    if (stored === "true" || stored === "false") {
      setCollapsed(stored === "true");
      return;
    }
    setCollapsed(window.matchMedia("(max-width: 720px)").matches);
  }, []);

  const toggleCollapsed = () => {
    setCollapsed((current) => {
      const next = !current;
      window.localStorage.setItem(UNIT_CONTEXT_COLLAPSED_STORAGE_KEY, String(next));
      return next;
    });
  };

  const toggleLabel = collapsed ? "Развернуть сведения о юните" : "Свернуть сведения о юните";

  return (
    <div className={styles.unitContext} data-collapsed={collapsed}>
      <div className={collapsed ? styles.unitContextCompactBar : styles.unitContextHeaderRow}>
        <div className={collapsed ? styles.unitContextCompactIdentity : styles.headerLeft}>
          <h1 className={collapsed ? styles.unitContextCompactTitle : styles.title}>{title}</h1>
          {!collapsed && description ? <p className={styles.subtitle}>{description}</p> : null}
        </div>

        {collapsed && showProgress ? (
          <div className={styles.unitContextCompactMetrics} aria-label="Краткий прогресс юнита">
            <span className={styles.unitContextCompactMetric}>
              <span>Прогресс</span>
              <strong>{completionMeter}%</strong>
            </span>
            <span className={styles.unitContextCompactMetric}>
              <span>Решено</span>
              <strong>
                {solvedTasks}/{totalTasks}
              </strong>
            </span>
            <span className={styles.unitContextCompactMetric}>
              <span>Ключевые</span>
              <strong>
                {requiredDone}/{requiredTotal}
              </strong>
            </span>
          </div>
        ) : null}

        <button
          type="button"
          className={styles.unitContextToggle}
          onClick={toggleCollapsed}
          aria-expanded={!collapsed}
          aria-controls={contentId}
          aria-label={toggleLabel}
          title={toggleLabel}
        >
          {collapsed ? <ChevronDown size={18} aria-hidden="true" /> : <ChevronUp size={18} aria-hidden="true" />}
        </button>
      </div>

      <div id={contentId} hidden={collapsed}>
        {showProgress ? (
          <StudentUnitProgressCard
            completionMeter={completionMeter}
            requiredDone={requiredDone}
            requiredTotal={requiredTotal}
            solvedTasks={solvedTasks}
            totalTasks={totalTasks}
          />
        ) : null}
      </div>
    </div>
  );
}
