"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, LazyMotion, domAnimation, m, type Variants } from "framer-motion";
import dynamic from "next/dynamic";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  ArrowLeft,
  BookOpen,
  Clock3,
  PlayCircle,
  Sparkles,
} from "lucide-react";
import DashboardShell from "@/components/StudentDashboardShell";
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
import { COURSES_QUERY_KEY, COURSES_QUERY_VALUE } from "./constants";
import {
  useStudentDashboardNavigation,
  type StudentDashboardBoot as Boot,
  type StudentDashboardView as View,
} from "./hooks/use-student-dashboard-navigation";

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

const StudentSectionGraphPanel = dynamic(() => import("./StudentSectionGraphPanel"), {
  ssr: false,
  loading: () => (
    <div className={styles.panel}>
      <div className={styles.empty}>Загрузка графа…</div>
    </div>
  ),
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
      <m.div
        className={styles.progressFill}
        initial={{ width: 0 }}
        animate={{ width: `${value}%` }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
      />
    </div>
  </div>
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
  const continueCourseCoverUrl = continueLearning
    ? getCourseCoverUrl(dashboardOverview, continueLearning.courseId)
    : null;

  return (
    <m.div variants={motionContainer} initial="hidden" animate="show" className={styles.panel}>
      <div className={styles.pageGlow} aria-hidden="true" />

      <m.section variants={motionItem} className={styles.pageIntro}>
        <h1 className={styles.pageTitle}>Обучение</h1>
        <p className={styles.pageSubtitle}>
          Продолжите изучение текущего материала или выберите новый курс.
        </p>
      </m.section>

      {/* Primary Action First! */}
      {continueLearning || !loadingCourses ? (
        <m.section variants={motionItem}>
          <div className={styles.continueCard}>
            <div className={styles.continueGlow} aria-hidden="true" />

            <div>
              <div className={styles.pillLabel}>
                <Clock3 size={12} className={styles.pillLabelBlue} />
                <span>Продолжить</span>
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
                <div className={styles.progressCaption}>Прогресс юнита</div>
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
                    <Image
                      alt=""
                      className={styles.continuePreviewImage}
                      src={continueCourseCoverUrl}
                      width={288}
                      height={288}
                      unoptimized
                    />
                  ) : (
                    <Sparkles size={22} />
                  )}
                </div>
              )}
            </div>
          </div>
        </m.section>
      ) : null}

      {/* Then all available courses grid */}
      <m.section variants={motionItem}>
        <div className={styles.sectionsListHead}>
          <h2 className={styles.gridTitle}>Все курсы</h2>
        </div>
        {loadingCourses ? (
          <div className={styles.empty}>Загрузка курсов…</div>
        ) : courses.length === 0 ? (
          <div className={styles.empty}>Пока нет опубликованных курсов</div>
        ) : (
          <div className={styles.sdGrid}>
            {courses.map(course => (
              <m.div key={course.id} variants={motionItem}>
                <div 
                  className={`${styles.sdCard} ${styles.sdCardHoverable}`} 
                  onClick={() => onCourseClick(course.id)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onCourseClick(course.id) }}
                >
                  {getCourseCoverUrl(dashboardOverview, course.id) ? (
                    <div className={styles.sdCardMedia}>
                      <Image 
                        src={getCourseCoverUrl(dashboardOverview, course.id)!} 
                        alt="" 
                        className={styles.sdCardMediaImage} 
                        width={640} 
                        height={320} 
                        unoptimized 
                      />
                    </div>
                  ) : null}
                  <div className={styles.sdCardHeader}>
                    <h3 className={styles.sdCardTitle}>{course.title}</h3>
                    {course.description && <p className={styles.sdCardSubtitle}>{course.description}</p>}
                  </div>
                  <div className={styles.sdCardFooter}>
                    <div className={styles.flexRow}>
                      <span className={styles.mutedText}>Прогресс {getCourseProgress(dashboardOverview, course.id)}%</span>
                    </div>
                    <div className={styles.flexRow}>
                      <BookOpen size={14} className={styles.mutedText} /> 
                      <span className={styles.mutedText}>{getCourseSectionCount(dashboardOverview, course.id)}</span>
                    </div>
                  </div>
                </div>
              </m.div>
            ))}
          </div>
        )}
      </m.section>
    </m.div>
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
  <m.div variants={motionContainer} initial="hidden" animate="show" className={styles.sectionsPage}>
    <div className={styles.pageGlow} aria-hidden="true" />

    <m.div variants={motionItem} className={styles.sectionsBackRow}>
      <button type="button" className={styles.backChip} onClick={onBackToCourses}>
        <ArrowLeft className={styles.backChipIcon} size={16} strokeWidth={2.2} aria-hidden="true" />
        <span>К КУРСАМ</span>
      </button>
    </m.div>

    <m.header variants={motionItem} className={styles.sectionsHeroCard}>
      <div className={styles.sectionsHeroContent}>
         <h1 className={styles.pageTitle} style={{ marginBottom: "16px" }}>{course.title}</h1>
         {course.description && <p className={styles.pageSubtitle} style={{ marginBottom: "32px", maxWidth: "42rem" }}>{course.description}</p>}
         
         <div>
            <div className={styles.progressCaption}>Прогресс курса</div>
            <div className={styles.overallProgressValue} style={{ fontSize: "40px" }}>{courseSummary?.progressPercent ?? 0}%</div>
         </div>
      </div>
      {courseSummary?.coverImageUrl ? (
        <div className={styles.sectionsHeroMedia}>
          <Image
            alt=""
            className={styles.sectionsHeroMediaImage}
            src={courseSummary.coverImageUrl}
            width={800}
            height={600}
            unoptimized
          />
        </div>
      ) : null}
    </m.header>

    <m.section variants={motionItem} className={styles.sectionsListWrap}>
      <div className={styles.sectionsListHead}>
        <h2 className={styles.sectionsListTitle}>Разделы</h2>
      </div>

      <div className={styles.sdGridSingle}>
        {sections.length === 0 ? (
          <div className={styles.empty}>Разделов пока нет</div>
        ) : (
          sections.map((section, index) => (
             <m.div
              key={section.id}
              variants={motionItem}
             className={`${styles.sdCard} ${section.accessStatus === "locked" ? styles.sectionCardLocked : styles.sdCardHoverable}`}
              onClick={section.accessStatus === "locked" ? undefined : () => onSectionClick(section)}
              role="button"
              aria-disabled={section.accessStatus === "locked" ? "true" : undefined}
              tabIndex={section.accessStatus === "locked" ? -1 : 0}
              onKeyDown={(e) => {
                 if (section.accessStatus !== "locked" && (e.key === 'Enter' || e.key === ' ')) {
                   onSectionClick(section)
                 }
              }}
            >
              <div className={styles.sdCardHeader} style={{ flexDirection: 'row', alignItems: 'center', gap: '16px', paddingBottom: '24px' }}>
                 <div className={styles.sectionMediaBlock}>
                   <div className={styles.sectionOrdinalPill}>{String(index + 1).padStart(2, "0")}</div>
                   <div className={styles.sectionPlayBadge}>
                     <PlayCircle size={18} />
                   </div>
                 </div>
                 
                 <div style={{ flex: 1 }}>
                   <h3 className={styles.sdCardTitle} style={{ fontSize: '18px' }}>{section.title}</h3>
                   <p className={styles.sdCardSubtitle} style={{ marginTop: '8px', WebkitLineClamp: 3, lineClamp: 3 }}>
                     {getSectionDescription(section, index, course.title)}
                   </p>
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
                      {section.accessStatus !== "locked" && <ArrowRight size={14} />}
                    </span>
                 </div>
              </div>
            </m.div>
          ))
        )}
      </div>
    </m.section>
  </m.div>
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

type StudentDashboardScreenProps = {
  queryOverride?: boolean;
};

export default function StudentDashboardScreen({ queryOverride = false }: StudentDashboardScreenProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const handleLogout = useStudentLogout();
  const identity = useStudentIdentity();
  const navigation = useStudentDashboardNavigation({
    queryOverride,
    ensureCourse: (courseId: string) =>
      queryClient.ensureQueryData({
        queryKey: contentQueryKeys.studentCourse(courseId),
        queryFn: () => studentApi.getCourse(courseId),
      }),
  });
  const selectedCourseId = navigation.state.selectedCourseId;
  const selectedSectionId = navigation.state.selectedSectionId;

  const coursesQuery = useQuery({
    queryKey: contentQueryKeys.studentCourses(),
    queryFn: () => studentApi.listCourses(),
    enabled: navigation.state.boot === "ready",
  });
  const overviewQuery = useQuery({
    queryKey: contentQueryKeys.studentDashboardOverview(),
    queryFn: () => studentApi.getDashboardOverview(),
    enabled: navigation.state.boot === "ready",
  });
  const selectedCourseQuery = useQuery({
    queryKey: contentQueryKeys.studentCourse(selectedCourseId ?? ""),
    queryFn: () => studentApi.getCourse(selectedCourseId as string),
    enabled: navigation.state.boot === "ready" && Boolean(selectedCourseId),
  });
  const selectedSectionQuery = useQuery({
    queryKey: contentQueryKeys.studentSection(selectedSectionId ?? ""),
    queryFn: () => studentApi.getSection(selectedSectionId as string),
    enabled:
      navigation.state.boot === "ready" &&
      navigation.state.view === "graph" &&
      Boolean(selectedSectionId),
  });

  useEffect(() => {
    if (selectedSectionQuery.isSuccess) {
      navigation.restoreResolvedSection(selectedSectionQuery.data);
      return;
    }
    if (
      selectedSectionQuery.isError &&
      navigation.state.boot === "ready" &&
      navigation.state.view === "graph" &&
      navigation.state.selectedSectionId &&
      !navigation.state.selectedSectionTitle
    ) {
      navigation.handleGraphNotFound();
    }
  }, [
    navigation,
    navigation.state.boot,
    navigation.state.selectedSectionId,
    navigation.state.selectedSectionTitle,
    navigation.state.view,
    selectedSectionQuery.data,
    selectedSectionQuery.isError,
    selectedSectionQuery.isSuccess,
  ]);

  const courses: Course[] = coursesQuery.data ?? [];
  const selectedCourse: CourseWithSections | null = selectedCourseQuery.data ?? null;
  const loadingCourses = coursesQuery.isPending;
  const dashboardOverview = overviewQuery.data ?? null;

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
    () => getRequestError(coursesQuery, selectedCourseQuery, navigation.state.view),
    [coursesQuery, selectedCourseQuery, navigation.state.view],
  );
  const visibleError = navigation.state.error ?? requestError;

  const handleContinueLearning = useCallback(
    (href: string) => {
      router.push(href);
    },
    [router],
  );

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

        <LazyMotion features={domAnimation}>
          <StudentDashboardPanel
            boot={navigation.state.boot}
            courses={courses}
            dashboardOverview={dashboardOverview}
            loadingCourses={loadingCourses}
            onBackToCourses={navigation.handleBackToCourses}
            onCourseClick={navigation.handleCourseClick}
            onContinueLearning={handleContinueLearning}
            onGraphNotFound={navigation.handleGraphNotFound}
            onSectionClick={navigation.handleSectionClick}
            onSectionsBack={navigation.handleBackToSections}
            sections={sortedSections}
            selectedCourse={selectedCourse}
            selectedSectionId={navigation.state.selectedSectionId}
            selectedSectionTitle={navigation.state.selectedSectionTitle}
            view={navigation.state.view}
          />
        </LazyMotion>
      </div>
    </DashboardShell>
  );
}
