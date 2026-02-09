"use client";

import { useCallback, useEffect, useId, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { studentApi, UnitWithTasks, Task } from "@/lib/api/student";
import { getStudentErrorMessage } from "../shared/student-errors";
import StudentNotFound from "../shared/StudentNotFound";
import styles from "./student-unit-detail.module.css";
import DashboardShell from "@/components/DashboardShell";
import Tabs from "@/components/ui/Tabs";
import { toYouTubeEmbed } from "@/lib/video-embed";
import Button from "@/components/ui/Button";
import LiteTex from "@/components/LiteTex";
import { useStudentLogout } from "../auth/use-student-logout";

type Props = {
  unitId: string;
};

type TabKey = "theory" | "method" | "tasks" | "video" | "attachments";

export default function StudentUnitDetailScreen({ unitId }: Props) {
  const tabsId = useId();
  const router = useRouter();
  const handleLogout = useStudentLogout();
  const [unit, setUnit] = useState<UnitWithTasks | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [activeTab, setActiveTab] = useState<TabKey>("tasks");
  const [activeTaskIndex, setActiveTaskIndex] = useState(0);
  const [completedTaskIds, setCompletedTaskIds] = useState<Set<string>>(() => new Set());

  const fetchUnit = useCallback(async () => {
    setError(null);
    setNotFound(false);
    try {
      const data = await studentApi.getUnit(unitId);
      setUnit(data);
    } catch (err) {
      const message = getStudentErrorMessage(err);
      if (message === "Не найдено или недоступно") setNotFound(true);
      setError(message);
    }
  }, [unitId]);

  useEffect(() => {
    fetchUnit();
  }, [fetchUnit]);

  const navItems = useMemo(
    () => [
      {
        label: "Курсы",
        href: "/student?view=courses",
        active: true,
      },
    ],
    [],
  );

  const videos = useMemo(
    () => (unit?.videosJson ?? []).filter((v) => v.embedUrl.trim().length > 0),
    [unit?.videosJson],
  );
  const hasMethod = Boolean(unit?.methodPdfAssetKey || unit?.methodRichLatex);
  const hasAttachments = Boolean(unit?.attachmentsJson && unit.attachmentsJson.length > 0);

  const tabs = useMemo(() => {
    const nextTabs: { key: TabKey; label: string }[] = [
      { key: "theory", label: "Теория" },
      ...(hasMethod ? ([{ key: "method", label: "Методика" }] as const) : []),
      { key: "tasks", label: "Задачи" },
      ...(videos.length ? ([{ key: "video", label: "Видео" }] as const) : []),
      ...(hasAttachments ? ([{ key: "attachments", label: "Вложения" }] as const) : []),
    ];
    return nextTabs;
  }, [hasMethod, hasAttachments, videos.length]);

  useEffect(() => {
    if (!tabs.find((tab) => tab.key === activeTab)) {
      setActiveTab(tabs[0]?.key ?? "tasks");
    }
  }, [activeTab, tabs]);

  const activePanelId = `${tabsId}-${activeTab}-panel`;
  const activeTabId = `${tabsId}-${activeTab}`;

  const orderedTasks = useMemo(() => {
    if (!unit?.tasks) return [];
    return [...unit.tasks].sort((a, b) => {
      if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    });
  }, [unit?.tasks]);

  useEffect(() => {
    if (!orderedTasks.length) {
      setActiveTaskIndex(0);
      setCompletedTaskIds(new Set());
      return;
    }
    setActiveTaskIndex((prev) => (prev < orderedTasks.length ? prev : 0));
  }, [orderedTasks.length]);

  const maxCompletedIndex = useMemo(() => {
    let max = -1;
    orderedTasks.forEach((task, index) => {
      if (completedTaskIds.has(task.id)) max = Math.max(max, index);
    });
    return max;
  }, [completedTaskIds, orderedTasks]);

  const maxUnlockedIndex = useMemo(
    () => Math.min(maxCompletedIndex + 1, Math.max(0, orderedTasks.length - 1)),
    [maxCompletedIndex, orderedTasks.length],
  );
  const activeTask = useMemo(() => orderedTasks[activeTaskIndex], [activeTaskIndex, orderedTasks]);
  const activeTaskCompleted = useMemo(
    () => (activeTask ? completedTaskIds.has(activeTask.id) : false),
    [activeTask, completedTaskIds],
  );
  const canGoNext = useMemo(
    () => activeTaskCompleted && activeTaskIndex < orderedTasks.length - 1,
    [activeTaskCompleted, activeTaskIndex, orderedTasks.length],
  );

  return (
    <DashboardShell title="Ученик" navItems={navItems} appearance="glass" onLogout={handleLogout}>
      <div className={styles.content}>
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            <h1 className={styles.title}>{unit?.title ?? "Юнит"}</h1>
            <p className={styles.subtitle}>Материалы юнита</p>
          </div>
        </div>

        {notFound ? <StudentNotFound /> : null}
        {error && !notFound ? (
          <div className={styles.error} role="status" aria-live="polite">
            {error}
          </div>
        ) : null}

        <div className={styles.tabsRow}>
          <Tabs
            idBase={tabsId}
            tabs={tabs}
            active={activeTab}
            onChange={setActiveTab}
            ariaLabel="Вкладки юнита"
          />
          <Button variant="ghost" onClick={() => router.back()} className={styles.backInline}>
            ← Назад
          </Button>
        </div>

        <div id={activePanelId} role="tabpanel" aria-labelledby={activeTabId}>
          {activeTab === "theory" ? (
            <div className={styles.stub}>PDF будет показан здесь после сборки и публикации учителем.</div>
          ) : activeTab === "method" ? (
            <div className={styles.stub}>PDF будет показан здесь после сборки и публикации учителем.</div>
          ) : activeTab === "video" ? (
            <div className={styles.videoList}>
              {videos.length === 0 ? (
                <div className={styles.stub}>Видео пока не добавлены.</div>
              ) : (
                videos.map((video) => {
                  const embed = toYouTubeEmbed(video.embedUrl);
                  return (
                    <div key={video.id} className={styles.videoCard}>
                      <div className={styles.videoTitle}>{video.title}</div>
                      {embed ? (
                        <iframe
                          className={styles.videoFrame}
                          src={embed}
                          title={video.title}
                          loading="lazy"
                          referrerPolicy="strict-origin-when-cross-origin"
                          sandbox="allow-scripts allow-same-origin allow-presentation"
                          allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture; web-share"
                          allowFullScreen
                        />
                      ) : (
                        <div className={styles.stub}>Неподдерживаемая ссылка на видео.</div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          ) : activeTab === "attachments" ? (
            <div className={styles.stub}>Вложения будут добавлены позже.</div>
          ) : (
            <div className={styles.tasks}>
              {orderedTasks.length ? (
                <>
                  <div className={styles.taskTabs}>
                    {orderedTasks.map((task, index) => {
                      const isCompleted = completedTaskIds.has(task.id);
                      const isActive = index === activeTaskIndex;
                      const isEnabled = index <= maxUnlockedIndex || isCompleted;
                      return (
                        <button
                          key={task.id}
                          type="button"
                          className={`${styles.taskTab} ${
                            isActive ? styles.taskTabActive : ""
                          } ${isCompleted ? styles.taskTabDone : ""}`}
                          disabled={!isEnabled}
                          onClick={() => {
                            if (!isEnabled) return;
                            setActiveTaskIndex(index);
                          }}
                        >
                          {index + 1}
                        </button>
                      );
                    })}
                  </div>

                  {activeTask ? (
                    <div className={styles.taskCard}>
                      <div className={styles.taskHeader}>
                        <div className={styles.taskTitle}>Задача №{activeTaskIndex + 1}</div>
                        {activeTask.isRequired ? (
                          <span className={styles.taskBadge}>Обязательная</span>
                        ) : null}
                      </div>
                      <div className={styles.taskStatement}>
                        <LiteTex value={activeTask.statementLite} block />
                      </div>

                      {activeTask.answerType === "numeric" ? (
                        <div className={styles.answerList}>
                          {(activeTask.numericPartsJson ?? []).length === 0 ? (
                            <div className={styles.stub}>Части ответа будут добавлены позже.</div>
                          ) : (
                            (activeTask.numericPartsJson ?? []).map((part, idx) => (
                              <div key={part.key} className={styles.answerRow}>
                                <div className={styles.answerInline}>
                                  <span className={styles.answerIndex}>{idx + 1}.</span>
                                  <span className={styles.answerLabelText}>
                                    <LiteTex value={part.labelLite ?? ""} />
                                  </span>
                                  <input className={styles.answerInputInline} disabled placeholder="" />
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      ) : null}

                      {activeTask.answerType === "single_choice" ||
                      activeTask.answerType === "multi_choice" ? (
                        <div className={styles.optionList}>
                          {(activeTask.choicesJson ?? []).length === 0 ? (
                            <div className={styles.stub}>Варианты ответа будут добавлены позже.</div>
                          ) : (
                            (activeTask.choicesJson ?? []).map((choice, idx) => (
                              <div key={choice.key} className={styles.optionItem}>
                                <span className={styles.optionKey}>{idx + 1}</span>
                                <LiteTex value={choice.textLite} />
                              </div>
                            ))
                          )}
                        </div>
                      ) : null}

                      {activeTask.answerType === "photo" ? (
                        <div className={styles.stub}>Фото-ответ будет в следующем слайсе.</div>
                      ) : null}

                      <div className={styles.taskActions}>
                        {!activeTaskCompleted ? (
                          <Button
                            variant="ghost"
                            onClick={() => {
                              setCompletedTaskIds((prev) => new Set(prev).add(activeTask.id));
                            }}
                          >
                            Отметить как решено
                          </Button>
                        ) : (
                          <div className={styles.taskDone}>Задача отмечена как решённая.</div>
                        )}
                        {canGoNext ? (
                          <Button variant="ghost" onClick={() => setActiveTaskIndex(activeTaskIndex + 1)}>
                            К следующей задаче
                          </Button>
                        ) : null}
                      </div>
                    </div>
                  ) : null}
                </>
              ) : (
                <div className={styles.stub}>Задач пока нет.</div>
              )}
            </div>
          )}
        </div>
      </div>
    </DashboardShell>
  );
}
