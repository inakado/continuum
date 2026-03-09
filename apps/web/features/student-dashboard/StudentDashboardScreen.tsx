"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion, type Variants } from "framer-motion";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  BookOpen,
  ChevronLeft,
  Clock3,
  PlayCircle,
  Sparkles,
} from "lucide-react";
import DashboardShell from "@/components/DashboardShell";
import {
  studentApi,
  type Course,
  type CourseWithSections,
  type Section,
  type StudentDashboardCourseSummary,
  type StudentDashboardOverview,
} from "@/lib/api/student";
import { contentQueryKeys } from "@/lib/query/keys";
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

type QueryErrorState = {
  error: Error | null;
  isError: boolean;
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

const motionContainer: Variants = {
  hidden: { opacity: 0, y: 14 },
  show: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.42,
      ease: [0.16, 1, 0.3, 1],
      staggerChildren: 0.07,
    },
  },
};

const motionItem: Variants = {
  hidden: { opacity: 0, y: 16 },
  show: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.38,
      ease: [0.16, 1, 0.3, 1],
    },
  },
};

const carouselSwapMotion = {
  initial: { opacity: 0, scale: 0.98, filter: "blur(8px)" },
  animate: { opacity: 1, scale: 1, filter: "blur(0px)" },
  exit: { opacity: 0, scale: 1.02, filter: "blur(8px)" },
  transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] },
} as const;

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

const getCourseSummary = (
  overview: StudentDashboardOverview | null,
  courseId: string,
): StudentDashboardCourseSummary | null =>
  overview?.courses.find((course) => course.id === courseId) ?? null;

const getCourseProgress = (overview: StudentDashboardOverview | null, courseId: string) =>
  getCourseSummary(overview, courseId)?.progressPercent ?? 0;

const getCourseUnitCount = (overview: StudentDashboardOverview | null, courseId: string) =>
  getCourseSummary(overview, courseId)?.unitCount ?? 0;

const getCourseSectionCount = (overview: StudentDashboardOverview | null, courseId: string) =>
  getCourseSummary(overview, courseId)?.sectionCount ?? 0;

const getCourseCoverUrl = (overview: StudentDashboardOverview | null, courseId: string) =>
  getCourseSummary(overview, courseId)?.coverImageUrl ?? null;

const getSectionDescription = (section: Section, index: number, courseTitle: string) =>
  section.description?.trim() ||
  `Раздел ${String(index + 1).padStart(2, "0")} курса «${courseTitle}». Откройте его, чтобы перейти в граф юнитов.`;

const compareSections = (left: Section, right: Section) => {
  if (left.sortOrder !== right.sortOrder) {
    return left.sortOrder - right.sortOrder;
  }
  return new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime();
};

const ProgressBar = ({
  value,
  label,
  showValue = true,
}: {
  value: number;
  label: string;
  showValue?: boolean;
}) => (
  <div className={styles.progressMetric}>
    <div className={styles.progressMetricRow}>
      <span>{label}</span>
      {showValue ? <span>{value}%</span> : null}
    </div>
    <div className={styles.progressTrack} aria-hidden="true">
      <motion.div
        className={styles.progressFill}
        initial={{ width: 0 }}
        animate={{ width: `${value}%` }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
      />
    </div>
  </div>
);

const StudentCourseCarousel = ({
  courses,
  dashboardOverview,
  initialCourseId,
  onCourseClick,
}: {
  courses: Course[];
  dashboardOverview: StudentDashboardOverview | null;
  initialCourseId: string | null;
  onCourseClick: (courseId: string) => void;
}) => {
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    if (courses.length === 0) {
      setActiveIndex(0);
      return;
    }
    const preferredIndex = initialCourseId ? courses.findIndex((course) => course.id === initialCourseId) : 0;
    if (preferredIndex >= 0) {
      setActiveIndex(preferredIndex);
      return;
    }
    setActiveIndex((current) => (current >= courses.length ? 0 : current));
  }, [courses, initialCourseId]);

  if (courses.length === 0) {
    return <div className={styles.empty}>Пока нет опубликованных курсов</div>;
  }

  const safeIndex = Math.min(activeIndex, courses.length - 1);
  const activeCourse = courses[safeIndex] ?? courses[0];
  const deckCourses = courses.filter((_, index) => index !== safeIndex);
  const activeCourseProgress = getCourseProgress(dashboardOverview, activeCourse.id);
  const activeCourseSections = getCourseSectionCount(dashboardOverview, activeCourse.id);
  const activeCourseCoverUrl = getCourseCoverUrl(dashboardOverview, activeCourse.id);

  return (
    <div className={styles.carouselRoot}>
      <div className={styles.carouselActiveArea}>
        <AnimatePresence mode="wait">
          <motion.div
            key={activeCourse.id}
            className={styles.carouselActiveCard}
            initial={carouselSwapMotion.initial}
            animate={carouselSwapMotion.animate}
            exit={carouselSwapMotion.exit}
            transition={carouselSwapMotion.transition}
          >
            <div className={styles.carouselMainRow}>
              <div className={styles.carouselContent}>
                <h2 className={styles.carouselTitle}>{activeCourse.title}</h2>
                <div className={styles.carouselDescriptionWrap}>
                  <div className={styles.carouselDescriptionLine} />
                  <p className={styles.carouselDescription}>
                    {activeCourse.description ?? "Описание курса появится после публикации преподавателем."}
                  </p>
                </div>
              </div>

              <div className={styles.carouselMediaPane}>
                {activeCourseCoverUrl ? (
                  <div className={styles.carouselDecoration}>
                    <img alt="" className={styles.carouselDecorationImage} src={activeCourseCoverUrl} />
                  </div>
                ) : null}
              </div>
            </div>

            <div className={styles.carouselFooter}>
              <div className={styles.carouselStats}>
                <div className={styles.carouselStat}>
                  <div className={styles.carouselStatLabel}>Прогресс</div>
                  <div className={styles.carouselStatValue}>{activeCourseProgress}%</div>
                </div>
                <div className={styles.carouselDivider} />
                <div className={styles.carouselStat}>
                  <div className={styles.carouselStatLabel}>
                    <BookOpen size={12} /> Разделов
                  </div>
                  <div className={styles.carouselStatValue}>{activeCourseSections}</div>
                </div>
              </div>

              <div className={styles.carouselActionCell}>
                <button
                  type="button"
                  aria-label={activeCourse.title}
                  className={styles.darkActionButton}
                  onClick={() => onCourseClick(activeCourse.id)}
                >
                  Перейти к курсу
                  <ArrowRight size={18} />
                </button>
              </div>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      <div className={styles.carouselDeckArea}>
        <div className={styles.carouselDeckStack}>
          <AnimatePresence>
            {deckCourses.map((course, index) => {
              const originalIndex = courses.findIndex((candidate) => candidate.id === course.id);
              const courseCoverUrl = getCourseCoverUrl(dashboardOverview, course.id);
              return (
                <motion.button
                  key={course.id}
                  type="button"
                  className={styles.deckCard}
                  onClick={() => setActiveIndex(originalIndex)}
                  initial={{ opacity: 0, x: 30, scale: 0.9 }}
                  animate={{
                    opacity: 1,
                    x: 0,
                    y: index * -18,
                    scale: 1 - index * 0.04,
                    rotateZ: index === 0 ? 0 : index % 2 === 0 ? 2 : -2,
                  }}
                  exit={{ opacity: 0, x: -30, scale: 0.9 }}
                  transition={{
                    type: "spring",
                    stiffness: 300,
                    damping: 25,
                    delay: index * 0.05,
                  }}
                >
                  <div className={styles.deckCardHeader}>
                    <div className={styles.deckArrowIcon}>
                      <ArrowRight size={12} />
                    </div>
                  </div>

                  <div>
                    {courseCoverUrl ? (
                      <div className={styles.deckCoverFrame}>
                        <img alt="" className={styles.deckCoverImage} src={courseCoverUrl} />
                      </div>
                    ) : null}
                    <h3 className={styles.deckTitle}>{course.title}</h3>
                  </div>
                </motion.button>
              );
            })}
          </AnimatePresence>
        </div>

        <div className={styles.carouselDeckInfo}>
          <span className={styles.carouselDeckInfoActive}>{safeIndex + 1}</span> / {courses.length}
        </div>
      </div>
    </div>
  );
};

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
  const continueCourseCoverUrl = continueLearning
    ? getCourseCoverUrl(dashboardOverview, continueLearning.courseId)
    : null;

  return (
    <motion.div variants={motionContainer} initial="hidden" animate="show" className={styles.panel}>
      <div className={styles.pageGlow} aria-hidden="true" />

      <motion.section variants={motionItem} className={styles.pageIntro}>
        <h1 className={styles.pageTitle}>Мои курсы</h1>
        <p className={styles.pageSubtitle}>
          Выберите курс, чтобы продолжить обучение. Здесь собраны все доступные программы.
        </p>
      </motion.section>

      <motion.section variants={motionItem}>
        {loadingCourses ? (
          <div className={styles.empty}>Загрузка курсов…</div>
        ) : (
          <StudentCourseCarousel
            courses={courses}
            dashboardOverview={dashboardOverview}
            initialCourseId={continueLearning?.courseId ?? null}
            onCourseClick={onCourseClick}
          />
        )}
      </motion.section>

      <motion.section variants={motionItem} className={styles.bottomGrid}>
        <div className={styles.continueCard}>
          <div className={styles.continueGlow} aria-hidden="true" />

          <div>
            <div className={styles.pillLabel}>
              <Clock3 size={12} className={styles.pillLabelBlue} />
              <span>Продолжить обучение</span>
            </div>

            {continueLearning ? (
              <>
                <h2 className={styles.continueTitle}>{continueLearning.unitTitle}</h2>
                <p className={styles.continueMeta}>
                  Раздел: {continueLearning.sectionTitle} • Курс: {continueLearning.courseTitle}
                </p>
              </>
            ) : (
              <>
                <h2 className={styles.continueTitle}>Следующий шаг появится здесь</h2>
                <p className={styles.continueMeta}>
                  Как только преподаватель откроет новый юнит, на карточке появится точка возврата.
                </p>
              </>
            )}
          </div>

          <div className={styles.continueBottom}>
            <div className={styles.continueProgressBox}>
              <div className={styles.progressCaption}>Прогресс раздела</div>
              <div className={styles.progressValue}>
                {continueLearning ? `${continueLearning.completionPercent}%` : "0%"}
              </div>
            </div>

            {continueLearning ? (
              <button
                type="button"
                className={styles.darkActionButton}
                onClick={() => onContinueLearning(continueLearning.href)}
              >
                Продолжить обучение
                <ArrowRight size={16} />
              </button>
            ) : (
              <div className={styles.continueImagePlaceholder}>
                {continueCourseCoverUrl ? (
                  <img alt="" className={styles.continuePreviewImage} src={continueCourseCoverUrl} />
                ) : (
                  <Sparkles size={22} />
                )}
              </div>
            )}
          </div>
        </div>
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
  <motion.div variants={motionContainer} initial="hidden" animate="show" className={styles.sectionsPage}>
    <div className={styles.pageGlow} aria-hidden="true" />

    <motion.div variants={motionItem} className={styles.sectionsBackRow}>
      <button type="button" className={styles.backChip} onClick={onBackToCourses}>
        <ChevronLeft size={14} aria-hidden="true" />
        <span>Курсы</span>
      </button>
    </motion.div>

    <motion.header variants={motionItem} className={styles.sectionsHeader}>
      <div className={styles.sectionsMainCard}>
        <div className={styles.sectionsHero}>
          <div className={styles.sectionsHeroCopy}>
            <h1 className={styles.sectionsCourseTitle}>{course.title}</h1>
            {course.description ? (
              <p className={styles.sectionsCourseDescription}>{course.description}</p>
            ) : null}
          </div>

          <div className={styles.sectionsHeaderDecoration}>
            {courseSummary?.coverImageUrl ? (
              <img alt="" className={styles.sectionsHeaderDecorationImage} src={courseSummary.coverImageUrl} />
            ) : null}
          </div>
        </div>

        <div className={styles.sectionsHeroFooter}>
          <div className={styles.sectionsProgressPanel}>
            <div className={styles.progressCaption}>Общий прогресс</div>
            <div className={styles.overallProgressValue}>{courseSummary?.progressPercent ?? 0}%</div>
            <ProgressBar value={courseSummary?.progressPercent ?? 0} label="По курсу" showValue={false} />
          </div>
        </div>
      </div>
    </motion.header>

    <motion.section variants={motionItem} className={styles.sectionsListWrap}>
      <div className={styles.sectionsListHead}>
        <h2 className={styles.sectionsListTitle}>Разделы курса</h2>
      </div>

      <div className={styles.sectionsList}>
        {sections.length === 0 ? (
          <div className={styles.empty}>Разделов пока нет</div>
        ) : (
          sections.map((section, index) => (
            <motion.button
              key={section.id}
              type="button"
              variants={motionItem}
              className={`${styles.sectionCard} ${section.accessStatus === "locked" ? styles.sectionCardLocked : ""}`}
              whileHover={section.accessStatus === "locked" ? undefined : { y: -2 }}
              whileTap={{ scale: 0.995 }}
              onClick={() => onSectionClick(section)}
              disabled={section.accessStatus === "locked"}
              aria-disabled={section.accessStatus === "locked"}
            >
              <div className={styles.sectionMediaBlock}>
                <div className={styles.sectionOrdinalPill}>{String(index + 1).padStart(2, "0")}</div>
                <div className={styles.sectionPlayBadge}>
                  <PlayCircle size={18} />
                </div>
              </div>

              <div className={styles.sectionContentBlock}>
                <div className={styles.sectionTitleRow}>
                  <h3 className={styles.sectionTitle}>{section.title}</h3>
                </div>
                <p className={styles.sectionDescription}>
                  {getSectionDescription(section, index, course.title)}
                </p>
                <div className={styles.sectionProgressInline}>
                  <div className={styles.progressCaption}>Прогресс</div>
                  <div className={styles.sectionProgressBadge}>{section.completionPercent ?? 0}%</div>
                </div>
                {section.accessStatus === "locked" ? (
                  <div className={styles.sectionLockHint}>Сначала завершите предыдущий раздел</div>
                ) : null}
              </div>

              <div className={styles.sectionActionBlock}>
                <span
                  className={`${styles.sectionOpenButton} ${
                    section.accessStatus === "locked" ? styles.sectionOpenButtonLocked : ""
                  }`}
                >
                  {section.accessStatus === "locked" ? "Заблокирован" : "Открыть"}
                  <ArrowRight size={14} />
                </span>
              </div>
            </motion.button>
          ))
        )}
      </div>
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
    return [...selectedCourse.sections].sort(compareSections);
  }, [selectedCourse]);

  const requestError = useMemo(
    () => getRequestError(coursesQuery, selectedCourseQuery, view),
    [coursesQuery, selectedCourseQuery, view],
  );
  const visibleError = error ?? requestError;

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
      if (section.accessStatus === "locked") {
        setError("Раздел заблокирован. Сначала завершите предыдущий раздел.");
        return;
      }
      setError(null);
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
      if (opened) return;
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
