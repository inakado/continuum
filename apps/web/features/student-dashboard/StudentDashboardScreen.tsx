"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion, type Variants } from "framer-motion";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import type { CSSProperties, ReactNode } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  BookOpen,
  ChevronLeft,
  Clock3,
  Layers3,
  Orbit,
  PlayCircle,
  Sparkles,
  Trophy,
} from "lucide-react";
import DashboardShell from "@/components/DashboardShell";
import Button from "@/components/ui/Button";
import {
  studentApi,
  type Course,
  type CourseWithSections,
  type Section,
  type StudentDashboardCourseSummary,
  type StudentDashboardOverview,
} from "@/lib/api/student";
import { contentQueryKeys } from "@/lib/query/keys";
import { getContentStatusLabel } from "@/lib/status-labels";
import { useStudentLogout } from "@/features/student-content/auth/use-student-logout";
import { useStudentIdentity } from "@/features/student-content/shared/use-student-identity";
import styles from "./student-dashboard.module.css";
import {
  COURSES_HASH,
  COURSES_QUERY_KEY,
  COURSES_QUERY_VALUE,
  LAST_SECTION_KEY,
} from "./constants";

type View = "courses" | "sections" | "graph";
type Boot = "checking_last" | "ready";
type HistoryMode = "push" | "replace" | "none";

type StudentDashboardHistoryState = {
  __continuumStudentNav: true;
  view: View;
  courseId: string | null;
  sectionId: string | null;
  sectionTitle: string | null;
};

type DashboardHeaderState = {
  title: string;
  subtitle: string;
  showBackToCourses: boolean;
};

type StudentDashboardPanelProps = {
  boot: Boot;
  courses: Course[];
  dashboardOverview: StudentDashboardOverview | null;
  loadingCourses: boolean;
  onBackToCourses: () => void;
  onCourseClick: (courseId: string) => void;
  onContinueLearning: (href: string) => void;
  onGraphNotFound: () => void;
  onSectionClick: (section: Section) => void;
  onSectionsBack: () => void;
  sections: Section[];
  selectedCourse: CourseWithSections | null;
  selectedSectionId: string | null;
  selectedSectionTitle: string | null;
  view: View;
};

type QueryErrorState = {
  error: Error | null;
  isError: boolean;
};

type DashboardTone = {
  accent: string;
  accentSoft: string;
  glow: string;
  edge: string;
  ink: string;
};

const DASHBOARD_TONES: readonly DashboardTone[] = [
  {
    accent: "#2f6fed",
    accentSoft: "rgba(47, 111, 237, 0.16)",
    glow: "rgba(114, 167, 255, 0.42)",
    edge: "rgba(47, 111, 237, 0.2)",
    ink: "#17305f",
  },
  {
    accent: "#0f8a83",
    accentSoft: "rgba(15, 138, 131, 0.14)",
    glow: "rgba(114, 224, 213, 0.38)",
    edge: "rgba(15, 138, 131, 0.18)",
    ink: "#123f3b",
  },
  {
    accent: "#b5671b",
    accentSoft: "rgba(181, 103, 27, 0.14)",
    glow: "rgba(244, 183, 110, 0.34)",
    edge: "rgba(181, 103, 27, 0.18)",
    ink: "#4f2c0b",
  },
  {
    accent: "#7b4ce0",
    accentSoft: "rgba(123, 76, 224, 0.14)",
    glow: "rgba(173, 141, 255, 0.38)",
    edge: "rgba(123, 76, 224, 0.18)",
    ink: "#35205f",
  },
];

const motionEase = "easeOut" as const;

const motionContainer: Variants = {
  hidden: { opacity: 0, y: 18 },
  show: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.45,
      ease: motionEase,
      staggerChildren: 0.08,
    },
  },
};

const motionItem: Variants = {
  hidden: { opacity: 0, y: 20 },
  show: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.42,
      ease: motionEase,
    },
  },
};

const isStudentDashboardHistoryState = (value: unknown): value is StudentDashboardHistoryState => {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<StudentDashboardHistoryState>;
  return candidate.__continuumStudentNav === true;
};

const StudentSectionGraphPanel = dynamic(() => import("./StudentSectionGraphPanel"), {
  ssr: false,
  loading: () => (
    <div className={styles.panel}>
      <div className={styles.empty}>Загрузка графа…</div>
    </div>
  ),
});

const buildHistoryState = (
  view: View,
  courseId: string | null,
  sectionId: string | null,
  sectionTitle: string | null,
): Omit<StudentDashboardHistoryState, "__continuumStudentNav"> => ({
  view,
  courseId,
  sectionId,
  sectionTitle,
});

const getDashboardHeaderState = (view: View, sectionTitle: string | null): DashboardHeaderState => {
  if (view === "courses") {
    return {
      title: "Маршрут обучения",
      subtitle: "Курсы, следующий шаг и общий темп в одном экране.",
      showBackToCourses: false,
    };
  }

  if (view === "sections") {
    return {
      title: "Разделы курса",
      subtitle: "Откройте нужный раздел и перейдите в граф обучения.",
      showBackToCourses: true,
    };
  }

  return {
    title: sectionTitle ? `Граф раздела: ${sectionTitle}` : "Граф раздела",
    subtitle: "Линейный возврат в список разделов сохраняется через историю навигации.",
    showBackToCourses: false,
  };
};

const getRequestError = (
  coursesQuery: QueryErrorState,
  selectedCourseQuery: QueryErrorState,
  view: View,
) => {
  if (coursesQuery.isError) {
    return coursesQuery.error instanceof Error ? coursesQuery.error.message : "Ошибка загрузки курсов";
  }
  if (selectedCourseQuery.isError && view === "sections") {
    return selectedCourseQuery.error instanceof Error ? selectedCourseQuery.error.message : "Ошибка загрузки курса";
  }
  return null;
};

const hashSeed = (seed: string) => {
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) >>> 0;
  }
  return hash;
};

const getToneStyle = (seed: string): CSSProperties => {
  const tone = DASHBOARD_TONES[hashSeed(seed) % DASHBOARD_TONES.length] ?? DASHBOARD_TONES[0];
  return {
    "--dash-accent": tone.accent,
    "--dash-accent-soft": tone.accentSoft,
    "--dash-glow": tone.glow,
    "--dash-edge": tone.edge,
    "--dash-ink": tone.ink,
  } as CSSProperties;
};

const getCourseSummary = (
  overview: StudentDashboardOverview | null,
  courseId: string,
): StudentDashboardCourseSummary | null =>
  overview?.courses.find((course) => course.id === courseId) ?? null;

const getCourseMeta = (summary: StudentDashboardCourseSummary | null) => {
  if (!summary) {
    return {
      sectionCount: null,
      unitCount: null,
      progressPercent: null,
      coverImageUrl: null,
    };
  }

  return {
    sectionCount: summary.sectionCount,
    unitCount: summary.unitCount,
    progressPercent: summary.progressPercent,
    coverImageUrl: summary.coverImageUrl,
  };
};

const getSectionDescription = (section: Section, index: number, courseTitle: string) =>
  section.description?.trim() ||
  `Раздел ${String(index + 1).padStart(2, "0")} курса «${courseTitle}». Откройте граф, чтобы продолжить обучение по узлам.`;

const ProgressBar = ({
  value,
  label,
}: {
  value: number;
  label: string;
}) => (
  <div className={styles.progressBlock}>
    <div className={styles.progressLabelRow}>
      <span>{label}</span>
      <span>{value}%</span>
    </div>
    <div className={styles.progressTrack} aria-hidden="true">
      <motion.div
        className={styles.progressFill}
        initial={{ width: 0 }}
        animate={{ width: `${value}%` }}
        transition={{ duration: 0.8, ease: motionEase }}
      />
    </div>
  </div>
);

const DashboardStatCard = ({
  icon,
  label,
  value,
  toneSeed,
}: {
  icon: ReactNode;
  label: string;
  value: string | number;
  toneSeed: string;
}) => (
  <motion.div variants={motionItem} className={styles.statCard} style={getToneStyle(toneSeed)}>
    <div className={styles.statIcon}>{icon}</div>
    <div className={styles.statValue}>{value}</div>
    <div className={styles.statLabel}>{label}</div>
  </motion.div>
);

const StudentCoursesView = ({
  courses,
  dashboardOverview,
  loadingCourses,
  onContinueLearning,
  onCourseClick,
}: {
  courses: Course[];
  dashboardOverview: StudentDashboardOverview | null;
  loadingCourses: boolean;
  onContinueLearning: (href: string) => void;
  onCourseClick: (courseId: string) => void;
}) => {
  const continueLearning = dashboardOverview?.continueLearning ?? null;
  const continueCourseSummary =
    continueLearning && dashboardOverview
      ? getCourseSummary(dashboardOverview, continueLearning.courseId)
      : null;

  return (
    <motion.div variants={motionContainer} initial="hidden" animate="show" className={styles.panel}>
      <div className={styles.heroBackdrop} aria-hidden="true">
        <div className={styles.heroGlowPrimary} />
        <div className={styles.heroGlowSecondary} />
      </div>

      <div className={styles.coursesTopGrid}>
        <motion.section
          variants={motionItem}
          className={styles.continueCard}
          style={getToneStyle(continueLearning?.courseId ?? "continue-learning")}
        >
          <div className={styles.heroEyebrow}>
            <Clock3 size={14} />
            <span>Продолжить обучение</span>
          </div>
          {continueLearning ? (
            <>
              <div className={styles.continueContent}>
                <div className={styles.continueCopy}>
                  <h2 className={styles.continueTitle}>{continueLearning.unitTitle}</h2>
                  <p className={styles.continueMeta}>
                    {continueLearning.courseTitle} · {continueLearning.sectionTitle}
                  </p>
                  <p className={styles.continueDescription}>
                    Вернитесь в последний доступный узел и продолжите движение по курсу без поиска
                    нужного раздела вручную.
                  </p>
                </div>
                <div className={styles.continueVisual}>
                  {continueCourseSummary?.coverImageUrl ? (
                    <img
                      alt=""
                      className={styles.heroCoverImage}
                      src={continueCourseSummary.coverImageUrl}
                    />
                  ) : (
                    <div className={styles.heroGlyph}>
                      <Orbit size={34} />
                    </div>
                  )}
                </div>
              </div>
              <div className={styles.continueFooter}>
                <div className={styles.continueMetrics}>
                  <ProgressBar value={continueLearning.completionPercent} label="Прогресс юнита" />
                  <ProgressBar value={continueLearning.solvedPercent} label="Решено задач" />
                </div>
                <Button
                  className={styles.heroButton}
                  onClick={() => onContinueLearning(continueLearning.href)}
                >
                  Продолжить обучение
                </Button>
              </div>
            </>
          ) : (
            <div className={styles.emptyState}>
              <div className={styles.emptyIcon}>
                <Sparkles size={18} />
              </div>
              <div>
                <h2 className={styles.emptyTitle}>Следующий шаг появится здесь</h2>
                <p className={styles.emptyText}>
                  Как только станет доступен новый юнит, дашборд покажет прямую точку входа.
                </p>
              </div>
            </div>
          )}
        </motion.section>

        <motion.aside variants={motionItem} className={styles.summaryCard}>
          <div className={styles.heroEyebrow}>
            <BookOpen size={14} />
            <span>Темп и обзор</span>
          </div>
          <div className={styles.summaryStack}>
            <div className={styles.summaryHighlight}>
              <div className={styles.summaryHighlightValue}>{courses.length}</div>
              <div className={styles.summaryHighlightLabel}>активных курсов в кабинете</div>
            </div>
            <div className={styles.summaryMiniGrid}>
              <div className={styles.summaryMiniMetric}>
                <span className={styles.summaryMiniLabel}>Доступно</span>
                <span className={styles.summaryMiniValue}>
                  {dashboardOverview?.stats.availableUnits ?? 0}
                </span>
              </div>
              <div className={styles.summaryMiniMetric}>
                <span className={styles.summaryMiniLabel}>В процессе</span>
                <span className={styles.summaryMiniValue}>
                  {dashboardOverview?.stats.inProgressUnits ?? 0}
                </span>
              </div>
              <div className={styles.summaryMiniMetric}>
                <span className={styles.summaryMiniLabel}>Завершено</span>
                <span className={styles.summaryMiniValue}>
                  {dashboardOverview?.stats.completedUnits ?? 0}
                </span>
              </div>
              <div className={styles.summaryMiniMetric}>
                <span className={styles.summaryMiniLabel}>Всего юнитов</span>
                <span className={styles.summaryMiniValue}>{dashboardOverview?.stats.totalUnits ?? 0}</span>
              </div>
            </div>
          </div>
        </motion.aside>
      </div>

      <motion.div variants={motionItem} className={styles.statGrid}>
        <DashboardStatCard
          icon={<Layers3 size={16} />}
          label="Разделов во всех курсах"
          value={dashboardOverview?.courses.reduce((sum, course) => sum + course.sectionCount, 0) ?? 0}
          toneSeed="stats-sections"
        />
        <DashboardStatCard
          icon={<Trophy size={16} />}
          label="Средний прогресс по курсам"
          value={
            dashboardOverview?.courses.length
              ? `${Math.round(
                  dashboardOverview.courses.reduce((sum, course) => sum + course.progressPercent, 0) /
                    dashboardOverview.courses.length,
                )}%`
              : "0%"
          }
          toneSeed="stats-progress"
        />
        <DashboardStatCard
          icon={<Orbit size={16} />}
          label="Точек входа прямо сейчас"
          value={dashboardOverview?.stats.availableUnits ?? 0}
          toneSeed="stats-entry"
        />
      </motion.div>

      <motion.section variants={motionItem} className={styles.courseRailSection}>
        <div className={styles.sectionHeading}>
          <div>
            <div className={styles.sectionHeadingKicker}>Курсы</div>
            <h2 className={styles.sectionHeadingTitle}>Выберите траекторию</h2>
          </div>
          <p className={styles.sectionHeadingText}>
            Крупные карточки ниже повторяют стилистику референса, но живут на наших контрактах и
            server-state слое.
          </p>
        </div>

        {loadingCourses ? (
          <div className={styles.empty}>Загрузка курсов…</div>
        ) : courses.length === 0 ? (
          <div className={styles.empty}>Пока нет опубликованных курсов</div>
        ) : (
          <div className={styles.courseRail} aria-label="Список курсов">
            {courses.map((course) => {
              const summary = getCourseSummary(dashboardOverview, course.id);
              const meta = getCourseMeta(summary);
              return (
                <motion.button
                  key={course.id}
                  type="button"
                  variants={motionItem}
                  className={styles.courseCard}
                  style={getToneStyle(course.id)}
                  whileHover={{ y: -4 }}
                  whileTap={{ scale: 0.99 }}
                  onClick={() => onCourseClick(course.id)}
                >
                  <div className={styles.courseArt}>
                    {meta.coverImageUrl ? (
                      <img alt="" className={styles.courseCoverImage} src={meta.coverImageUrl} />
                    ) : (
                      <div className={styles.courseGlyph}>
                        <BookOpen size={30} />
                      </div>
                    )}
                    <div className={styles.courseBadge}>
                      <span>{getContentStatusLabel(course.status)}</span>
                    </div>
                  </div>

                  <div className={styles.courseBody}>
                    <div className={styles.courseTitleRow}>
                      <h3 className={styles.courseTitle}>{course.title}</h3>
                      <ArrowRight size={18} />
                    </div>
                    <p className={styles.courseDescription}>{course.description ?? "Без описания курса"}</p>

                    <div className={styles.courseMetaGrid}>
                      <div className={styles.courseMetaPill}>
                        <span className={styles.courseMetaLabel}>Разделов</span>
                        <span className={styles.courseMetaValue}>{meta.sectionCount ?? "—"}</span>
                      </div>
                      <div className={styles.courseMetaPill}>
                        <span className={styles.courseMetaLabel}>Юнитов</span>
                        <span className={styles.courseMetaValue}>{meta.unitCount ?? "—"}</span>
                      </div>
                    </div>

                    <div className={styles.courseProgressFooter}>
                      <ProgressBar value={meta.progressPercent ?? 0} label="Общий прогресс" />
                    </div>
                  </div>
                </motion.button>
              );
            })}
          </div>
        )}
      </motion.section>
    </motion.div>
  );
};

const StudentSectionsView = ({
  course,
  courseSummary,
  onBackToCourses,
  onSectionClick,
  sections,
}: {
  course: CourseWithSections;
  courseSummary: StudentDashboardCourseSummary | null;
  onBackToCourses: () => void;
  onSectionClick: (section: Section) => void;
  sections: Section[];
}) => (
  <motion.div variants={motionContainer} initial="hidden" animate="show" className={styles.panel}>
    <motion.section variants={motionItem} className={styles.courseHero} style={getToneStyle(course.id)}>
      <div className={styles.courseHeroCopy}>
        <button type="button" className={styles.inlineBackButton} onClick={onBackToCourses}>
          <ChevronLeft size={16} />
          <span>Курсы</span>
        </button>

        <div className={styles.heroEyebrow}>
          <Sparkles size={14} />
          <span>Курс</span>
        </div>
        <h2 className={styles.courseHeroTitle}>{course.title}</h2>
        <p className={styles.courseHeroDescription}>
          {course.description ?? "Откройте нужный раздел и продолжите движение по учебному графу."}
        </p>
      </div>

      <div className={styles.courseHeroSide}>
        <div className={styles.heroSummaryCard}>
          <span className={styles.heroSummaryLabel}>Общий прогресс</span>
          <strong className={styles.heroSummaryValue}>{courseSummary?.progressPercent ?? 0}%</strong>
          <ProgressBar value={courseSummary?.progressPercent ?? 0} label="Пройдено по курсу" />
          <div className={styles.heroSummaryMeta}>
            <span>{courseSummary?.sectionCount ?? sections.length} разделов</span>
            <span>{courseSummary?.unitCount ?? 0} юнитов</span>
          </div>
        </div>
      </div>
    </motion.section>

    <motion.section variants={motionItem} className={styles.sectionDeck}>
      <div className={styles.sectionHeading}>
        <div>
          <div className={styles.sectionHeadingKicker}>Разделы</div>
          <h2 className={styles.sectionHeadingTitle}>Маршрут по курсу</h2>
        </div>
        <p className={styles.sectionHeadingText}>
          Каждый раздел открывает граф юнитов. Визуально это уже closer к референсу, но остаётся
          встроенным в текущую student navigation model.
        </p>
      </div>

      {sections.length === 0 ? (
        <div className={styles.empty}>Разделов пока нет</div>
      ) : (
        <div className={styles.sectionList}>
          {sections.map((section, index) => (
            <motion.button
              key={section.id}
              type="button"
              variants={motionItem}
              className={styles.sectionCard}
              style={getToneStyle(section.id)}
              whileHover={{ y: -3 }}
              whileTap={{ scale: 0.99 }}
              onClick={() => onSectionClick(section)}
            >
              <div className={styles.sectionCardVisual}>
                <span className={styles.sectionOrdinal}>{String(index + 1).padStart(2, "0")}</span>
                <div className={styles.sectionVisualBadge}>
                  <PlayCircle size={16} />
                </div>
              </div>

              <div className={styles.sectionCardBody}>
                <div className={styles.sectionCardHeading}>
                  <h3 className={styles.sectionCardTitle}>{section.title}</h3>
                  <span className={styles.status}>{getContentStatusLabel(section.status)}</span>
                </div>
                <p className={styles.sectionCardDescription}>
                  {getSectionDescription(section, index, course.title)}
                </p>
                <div className={styles.sectionCardFooter}>
                  <span className={styles.sectionFootnote}>Открыть граф раздела</span>
                  <ArrowRight size={18} />
                </div>
              </div>
            </motion.button>
          ))}
        </div>
      )}
    </motion.section>
  </motion.div>
);

const StudentDashboardPanel = ({
  boot,
  courses,
  dashboardOverview,
  loadingCourses,
  onBackToCourses,
  onCourseClick,
  onContinueLearning,
  onGraphNotFound,
  onSectionClick,
  onSectionsBack,
  sections,
  selectedCourse,
  selectedSectionId,
  selectedSectionTitle,
  view,
}: StudentDashboardPanelProps) => {
  if (boot !== "ready") {
    return <div className={styles.empty}>Загрузка…</div>;
  }

  if (view === "graph" && selectedSectionId) {
    return (
      <StudentSectionGraphPanel
        sectionId={selectedSectionId}
        sectionTitle={selectedSectionTitle}
        onBack={onSectionsBack}
        onNotFound={onGraphNotFound}
      />
    );
  }

  if (view === "sections" && selectedCourse) {
    return (
      <StudentSectionsView
        course={selectedCourse}
        courseSummary={getCourseSummary(dashboardOverview, selectedCourse.id)}
        onBackToCourses={onBackToCourses}
        onSectionClick={onSectionClick}
        sections={sections}
      />
    );
  }

  return (
    <StudentCoursesView
      courses={courses}
      dashboardOverview={dashboardOverview}
      loadingCourses={loadingCourses}
      onContinueLearning={onContinueLearning}
      onCourseClick={onCourseClick}
    />
  );
};

const useStudentDashboardBoot = ({
  forceShowCourses,
  queryOverride,
  router,
  setBoot,
  setSelectedSectionId,
  setSelectedSectionTitle,
  setView,
  writeHistoryState,
}: {
  forceShowCourses: () => void;
  queryOverride: boolean;
  router: ReturnType<typeof useRouter>;
  setBoot: (boot: Boot) => void;
  setSelectedSectionId: (sectionId: string | null) => void;
  setSelectedSectionTitle: (title: string | null) => void;
  setView: (view: View) => void;
  writeHistoryState: (
    next: Omit<StudentDashboardHistoryState, "__continuumStudentNav">,
    mode?: Exclude<HistoryMode, "none">,
  ) => void;
}) => {
  const skipAutoRestoreOnceRef = useRef(false);

  useEffect(() => {
    const hashOverride = typeof window !== "undefined" && window.location.hash === COURSES_HASH;
    if (queryOverride || hashOverride) {
      forceShowCourses();
      setBoot("ready");

      if (queryOverride) {
        skipAutoRestoreOnceRef.current = true;
        writeHistoryState(buildHistoryState("courses", null, null, null), "replace");
        router.replace("/student");
      }
      if (hashOverride) {
        window.history.replaceState(
          {
            __continuumStudentNav: true,
            ...buildHistoryState("courses", null, null, null),
          } satisfies StudentDashboardHistoryState,
          "",
          "/student",
        );
      }
      return;
    }

    if (skipAutoRestoreOnceRef.current) {
      skipAutoRestoreOnceRef.current = false;
      writeHistoryState(buildHistoryState("courses", null, null, null), "replace");
      setBoot("ready");
      return;
    }

    let initialState = buildHistoryState("courses", null, null, null);

    try {
      const stored = window.localStorage.getItem(LAST_SECTION_KEY);
      if (stored) {
        setSelectedSectionId(stored);
        setSelectedSectionTitle(null);
        setView("graph");
        initialState = buildHistoryState("graph", null, stored, null);
      }
    } catch {
      // ignore localStorage errors (private mode/etc.)
    } finally {
      writeHistoryState(initialState, "replace");
      setBoot("ready");
    }
  }, [
    forceShowCourses,
    queryOverride,
    router,
    setBoot,
    setSelectedSectionId,
    setSelectedSectionTitle,
    setView,
    writeHistoryState,
  ]);
};

const useStudentDashboardSectionRestore = ({
  boot,
  handleGraphNotFound,
  selectedSectionId,
  selectedSectionQuery,
  selectedSectionTitle,
  setSelectedCourseId,
  setSelectedSectionTitle,
  view,
  writeHistoryState,
}: {
  boot: Boot;
  handleGraphNotFound: () => void;
  selectedSectionId: string | null;
  selectedSectionQuery: ReturnType<typeof useQuery<Section>>;
  selectedSectionTitle: string | null;
  setSelectedCourseId: (courseId: string | null) => void;
  setSelectedSectionTitle: (title: string | null) => void;
  view: View;
  writeHistoryState: (
    next: Omit<StudentDashboardHistoryState, "__continuumStudentNav">,
    mode?: Exclude<HistoryMode, "none">,
  ) => void;
}) => {
  useEffect(() => {
    if (boot !== "ready" || view !== "graph" || !selectedSectionId || selectedSectionTitle) {
      return;
    }
    if (selectedSectionQuery.isSuccess) {
      const section = selectedSectionQuery.data;
      setSelectedSectionTitle(section.title);
      setSelectedCourseId(section.courseId);
      writeHistoryState(buildHistoryState("graph", section.courseId, section.id, section.title), "replace");
      return;
    }
    if (selectedSectionQuery.isError) {
      handleGraphNotFound();
    }
  }, [
    boot,
    handleGraphNotFound,
    selectedSectionId,
    selectedSectionQuery.data,
    selectedSectionQuery.isError,
    selectedSectionQuery.isSuccess,
    selectedSectionTitle,
    setSelectedCourseId,
    setSelectedSectionTitle,
    view,
    writeHistoryState,
  ]);
};

const useStudentDashboardPopState = ({
  boot,
  forceShowCourses,
  openCourse,
  setError,
  setSelectedCourseId,
  setSelectedSectionId,
  setSelectedSectionTitle,
  setView,
}: {
  boot: Boot;
  forceShowCourses: () => void;
  openCourse: (courseId: string, mode?: HistoryMode) => Promise<boolean>;
  setError: (error: string | null) => void;
  setSelectedCourseId: (courseId: string | null) => void;
  setSelectedSectionId: (sectionId: string | null) => void;
  setSelectedSectionTitle: (title: string | null) => void;
  setView: (view: View) => void;
}) => {
  useEffect(() => {
    if (boot !== "ready") return;

    const onPopState = (event: PopStateEvent) => {
      if (!isStudentDashboardHistoryState(event.state)) return;

      const next = event.state;
      if (next.view === "courses") {
        forceShowCourses();
        return;
      }

      if (next.view === "sections") {
        if (!next.courseId) {
          forceShowCourses();
          return;
        }
        void openCourse(next.courseId, "none");
        return;
      }

      if (!next.sectionId) {
        forceShowCourses();
        return;
      }

      setError(null);
      setSelectedSectionId(next.sectionId);
      setSelectedSectionTitle(next.sectionTitle);
      setSelectedCourseId(next.courseId);
      setView("graph");
    };

    window.addEventListener("popstate", onPopState);
    return () => {
      window.removeEventListener("popstate", onPopState);
    };
  }, [
    boot,
    forceShowCourses,
    openCourse,
    setError,
    setSelectedCourseId,
    setSelectedSectionId,
    setSelectedSectionTitle,
    setView,
  ]);
};

type StudentDashboardScreenProps = {
  queryOverride?: boolean;
};

export default function StudentDashboardScreen({ queryOverride = false }: StudentDashboardScreenProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const handleLogout = useStudentLogout();
  const identity = useStudentIdentity();
  const [boot, setBoot] = useState<Boot>("checking_last");
  const [view, setView] = useState<View>("courses");
  const [error, setError] = useState<string | null>(null);

  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(null);
  const [selectedSectionTitle, setSelectedSectionTitle] = useState<string | null>(null);
  const coursesQuery = useQuery({
    queryKey: contentQueryKeys.studentCourses(),
    queryFn: () => studentApi.listCourses(),
    enabled: boot === "ready",
  });
  const overviewQuery = useQuery({
    queryKey: contentQueryKeys.studentDashboardOverview(),
    queryFn: () => studentApi.getDashboardOverview(),
    enabled: boot === "ready",
  });
  const selectedCourseQuery = useQuery({
    queryKey: contentQueryKeys.studentCourse(selectedCourseId ?? ""),
    queryFn: () => studentApi.getCourse(selectedCourseId as string),
    enabled: boot === "ready" && Boolean(selectedCourseId),
  });
  const selectedSectionQuery = useQuery({
    queryKey: contentQueryKeys.studentSection(selectedSectionId ?? ""),
    queryFn: () => studentApi.getSection(selectedSectionId as string),
    enabled: boot === "ready" && view === "graph" && Boolean(selectedSectionId),
  });
  const courses: Course[] = coursesQuery.data ?? [];
  const selectedCourse: CourseWithSections | null = selectedCourseQuery.data ?? null;
  const loadingCourses = coursesQuery.isPending;
  const dashboardOverview = overviewQuery.data ?? null;

  const writeHistoryState = useCallback(
    (
      next: Omit<StudentDashboardHistoryState, "__continuumStudentNav">,
      mode: Exclude<HistoryMode, "none"> = "push",
    ) => {
      if (typeof window === "undefined") return;
      const fullState: StudentDashboardHistoryState = {
        __continuumStudentNav: true,
        ...next,
      };
      if (mode === "replace") {
        window.history.replaceState(fullState, "", window.location.href);
      } else {
        window.history.pushState(fullState, "", window.location.href);
      }
    },
    [],
  );

  const navItems = useMemo(
    () => [
      {
        label: "Курсы",
        href: `/student?${COURSES_QUERY_KEY}=${COURSES_QUERY_VALUE}`,
        active: true,
      },
    ],
    [],
  );

  const sortedSections = useMemo(() => {
    if (!selectedCourse) return [];
    return [...selectedCourse.sections].sort((a, b) => a.sortOrder - b.sortOrder);
  }, [selectedCourse]);
  const requestError = useMemo(
    () => getRequestError(coursesQuery, selectedCourseQuery, view),
    [coursesQuery, selectedCourseQuery, view],
  );
  const visibleError = error ?? requestError;
  const headerState = useMemo(
    () => getDashboardHeaderState(view, selectedSectionTitle),
    [selectedSectionTitle, view],
  );

  const openCourse = useCallback(
    async (courseId: string, mode: HistoryMode = "push") => {
      setError(null);
      try {
        const data = await queryClient.ensureQueryData({
          queryKey: contentQueryKeys.studentCourse(courseId),
          queryFn: () => studentApi.getCourse(courseId),
        });
        setSelectedCourseId(courseId);
        setSelectedSectionId(null);
        setSelectedSectionTitle(null);
        setView("sections");
        if (mode !== "none") {
          writeHistoryState(buildHistoryState("sections", data.id, null, null), mode);
        }
        return true;
      } catch (err) {
        setError(err instanceof Error ? err.message : "Ошибка загрузки курса");
        return false;
      }
    },
    [queryClient, writeHistoryState],
  );

  const forceShowCourses = useCallback(() => {
    setError(null);
    setSelectedCourseId(null);
    setSelectedSectionId(null);
    setSelectedSectionTitle(null);
    setView("courses");
  }, []);

  const handleGraphNotFound = useCallback(() => {
    try {
      window.localStorage.removeItem(LAST_SECTION_KEY);
    } catch {
      // ignore
    }
    setSelectedSectionId(null);
    setSelectedSectionTitle(null);
    setSelectedCourseId(null);
    setView("courses");
    writeHistoryState(buildHistoryState("courses", null, null, null), "replace");
  }, [writeHistoryState]);

  useStudentDashboardBoot({
    forceShowCourses,
    queryOverride,
    router,
    setBoot,
    setSelectedSectionId,
    setSelectedSectionTitle,
    setView,
    writeHistoryState,
  });

  useStudentDashboardSectionRestore({
    boot,
    handleGraphNotFound,
    selectedSectionId,
    selectedSectionQuery,
    selectedSectionTitle,
    setSelectedCourseId,
    setSelectedSectionTitle,
    view,
    writeHistoryState,
  });

  useStudentDashboardPopState({
    boot,
    forceShowCourses,
    openCourse,
    setError,
    setSelectedCourseId,
    setSelectedSectionId,
    setSelectedSectionTitle,
    setView,
  });

  const handleCourseClick = useCallback(
    async (courseId: string) => {
      void openCourse(courseId, "push");
    },
    [openCourse],
  );

  const handleContinueLearning = useCallback(
    (href: string) => {
      router.push(href);
    },
    [router],
  );

  const handleSectionClick = useCallback(
    (section: Section) => {
      setSelectedSectionId(section.id);
      setSelectedSectionTitle(section.title);
      setView("graph");
      writeHistoryState(buildHistoryState("graph", selectedCourseId, section.id, section.title), "push");
      try {
        window.localStorage.setItem(LAST_SECTION_KEY, section.id);
      } catch {
        // ignore
      }
    },
    [selectedCourseId, writeHistoryState],
  );

  const handleBackToCourses = useCallback(() => {
    forceShowCourses();
    writeHistoryState(buildHistoryState("courses", null, null, null), "push");
  }, [forceShowCourses, writeHistoryState]);

  const handleBackToSections = useCallback(async () => {
    if (selectedCourse) {
      setView("sections");
      writeHistoryState(buildHistoryState("sections", selectedCourse.id, null, null), "push");
      return;
    }
    if (selectedCourseId) {
      const opened = await openCourse(selectedCourseId, "push");
      if (opened) {
        return;
      }
    }
    forceShowCourses();
    writeHistoryState(buildHistoryState("courses", null, null, null), "push");
  }, [forceShowCourses, openCourse, selectedCourse, selectedCourseId, writeHistoryState]);

  return (
    <DashboardShell
      title={identity.displayName || "Профиль"}
      navItems={navItems}
      appearance="glass"
      onLogout={handleLogout}
    >
      <div className={styles.content}>
        <div className={styles.header}>
          <div>
            <div className={styles.headerEyebrow}>Student Dashboard</div>
            <h1 className={styles.title}>{headerState.title}</h1>
            <p className={styles.subtitle}>{headerState.subtitle}</p>
          </div>
          <div className={styles.actions}>
            {headerState.showBackToCourses ? (
              <Button variant="ghost" onClick={handleBackToCourses}>
                ← Курсы
              </Button>
            ) : null}
          </div>
        </div>

        {visibleError ? (
          <div className={styles.error} role="status" aria-live="polite">
            {visibleError}
          </div>
        ) : null}

        <StudentDashboardPanel
          boot={boot}
          courses={courses}
          dashboardOverview={dashboardOverview}
          loadingCourses={loadingCourses}
          onBackToCourses={handleBackToCourses}
          onCourseClick={handleCourseClick}
          onContinueLearning={handleContinueLearning}
          onGraphNotFound={handleGraphNotFound}
          onSectionClick={handleSectionClick}
          onSectionsBack={handleBackToSections}
          sections={sortedSections}
          selectedCourse={selectedCourse}
          selectedSectionId={selectedSectionId}
          selectedSectionTitle={selectedSectionTitle}
          view={view}
        />
      </div>
    </DashboardShell>
  );
}
