"use client";

import { useQuery } from "@tanstack/react-query";
import { Fragment, Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams, type ReadonlyURLSearchParams } from "next/navigation";
import { ChevronDown, ChevronRight, GraduationCap } from "lucide-react";
import LiteTex from "@/components/LiteTex";
import Button from "@/components/ui/Button";
import {
  teacherApi,
  type TeacherStudentTreeTask,
  type TeacherStudentTreeUnit,
} from "@/lib/api/teacher";
import { contentQueryKeys } from "@/lib/query/keys";
import { getStudentTaskStatusLabel, getStudentUnitStatusLabel } from "@/lib/status-labels";
import { formatApiErrorPayload } from "@/features/teacher-content/shared/api-errors";
import { buildReviewSearch } from "@/features/teacher-review/review-query";
import { useTeacherStudentProfileActions } from "./hooks/use-teacher-student-profile-actions";
import { useTeacherStudentProfileRouteState } from "./hooks/use-teacher-student-profile-route-state";
import {
  getDisplayName,
  type ProfileContext,
  type TeacherStudentProfileCourseTree,
  type TeacherStudentProfileDetails,
  type TeacherStudentProfileSection,
} from "./teacher-student-profile.shared";
import styles from "./teacher-student-profile-panel.module.css";

type Props = {
  studentId: string;
  fallbackName: string;
  onRefreshStudents?: () => Promise<void>;
};

const answerTypeLabel: Record<TeacherStudentTreeTask["answerType"], string> = {
  numeric: "Числовая",
  single_choice: "Один выбор",
  multi_choice: "Несколько выборов",
  photo: "Фото",
};

const statusClassName: Record<TeacherStudentTreeTask["state"]["status"], string> = {
  not_started: "statusNeutral",
  in_progress: "statusNeutral",
  pending_review: "statusWarning",
  accepted: "statusSuccess",
  rejected: "statusDanger",
  blocked: "statusDanger",
  credited_without_progress: "statusWarning",
  correct: "statusSuccess",
  teacher_credited: "statusSuccess",
};

const unitStatusClassName: Record<TeacherStudentTreeUnit["state"]["status"], string> = {
  locked: "unitStatusLocked",
  available: "unitStatusAvailable",
  in_progress: "unitStatusInProgress",
  completed: "unitStatusCompleted",
};

const sectionAccessStatusLabel: Record<TeacherStudentProfileSection["state"]["accessStatus"], string> = {
  locked: "Закрыт",
  available: "Открыт",
  completed: "Завершён",
};

const formatPercent = (value: number) => `${Math.round(value)}%`;

const countPendingInUnit = (unit: TeacherStudentTreeUnit) =>
  unit.tasks.reduce((acc, task) => acc + task.pendingPhotoReviewCount, 0);

const StudentProfileHeader = ({
  details,
  displayName,
  reviewInboxHref,
  reviewTotal,
}: {
  details: TeacherStudentProfileDetails | null;
  displayName: string;
  reviewInboxHref: string;
  reviewTotal: number;
}) => (
  <header className={styles.header}>
    <div className={styles.headerMain}>
      <h2 className={styles.title}>{displayName}</h2>
      {details ? (
        <div className={styles.headerMetaRow}>
          <span className={styles.headerMetaItem}>
            <span className={styles.headerMetaGlyph} aria-hidden="true">
              @
            </span>
            <span className={styles.headerMetaValue}>{details.profile.login}</span>
          </span>
          <span className={styles.headerMetaItem}>
            <GraduationCap className={styles.headerMetaIcon} aria-hidden="true" />
            <span className={styles.headerMetaValue}>
              {details.profile.leadTeacherDisplayName ?? details.profile.leadTeacherLogin ?? "—"}
            </span>
          </span>
        </div>
      ) : null}
    </div>
    <div className={styles.headerActions}>
      <Link
        href={reviewInboxHref}
        className={styles.reviewQueueLink}
        data-pending={reviewTotal > 0 ? "true" : "false"}
      >
        Задачи на проверку: {reviewTotal}
      </Link>
    </div>
  </header>
);

const DrilldownHeader = ({
  activeCourseId,
  onClearSelectedTask,
  onGoCoursesRoot,
  onGoSectionsRoot,
  onGoUnitsRoot,
  selectedCourse,
  selectedSection,
  selectedUnit,
}: {
  activeCourseId: string | null;
  onClearSelectedTask: () => void;
  onGoCoursesRoot: () => void;
  onGoSectionsRoot: () => void;
  onGoUnitsRoot: () => void;
  selectedCourse: TeacherStudentProfileDetails["courses"][number] | null;
  selectedSection: TeacherStudentProfileSection | null;
  selectedUnit: TeacherStudentTreeUnit | null;
}) => (
  <header className={styles.drillHeader}>
    <h3 className={styles.stageTitle}>Материалы и прогресс</h3>
    <nav className={styles.pathNav} aria-label="Иерархия контента">
      <button
        type="button"
        className={`${styles.pathButton} ${
          !selectedCourse && !selectedSection && !selectedUnit ? styles.pathCurrent : ""
        }`}
        onClick={onGoCoursesRoot}
      >
        Курсы
      </button>
      {selectedCourse ? (
        <>
          <span className={styles.pathSeparator}>›</span>
          <button
            type="button"
            className={`${styles.pathButton} ${
              selectedCourse && !selectedSection && !selectedUnit ? styles.pathCurrent : ""
            }`}
            onClick={onGoSectionsRoot}
          >
            {selectedCourse.title}
          </button>
        </>
      ) : null}
      {selectedSection ? (
        <>
          <span className={styles.pathSeparator}>›</span>
          <button
            type="button"
            className={`${styles.pathButton} ${selectedSection && !selectedUnit ? styles.pathCurrent : ""}`}
            onClick={onGoUnitsRoot}
          >
            {selectedSection.title}
          </button>
        </>
      ) : null}
      {selectedUnit ? (
        <>
          <span className={styles.pathSeparator}>›</span>
          <button
            type="button"
            className={`${styles.pathButton} ${styles.pathCurrent}`}
            onClick={() => {
              if (!activeCourseId || !selectedSection || !selectedUnit) return;
              onClearSelectedTask();
            }}
          >
            {selectedUnit.title}
          </button>
        </>
      ) : null}
    </nav>
  </header>
);

const CoursesStage = ({
  courses,
  onOpenCourse,
}: {
  courses: TeacherStudentProfileDetails["courses"];
  onOpenCourse: (courseId: string) => void;
}) => (
  <section>
      <div className={styles.list}>
        {courses.map((course) => (
          <article key={course.id} className={`${styles.card} ${styles.rowCard} ${styles.clickableCard}`}>
            <button
              type="button"
              className={styles.cardPrimaryButton}
              onClick={() => onOpenCourse(course.id)}
            >
              <div className={styles.cardBody}>
                <div className={styles.cardTitle}>{course.title}</div>
                <div className={styles.metaRow}>Перейти к разделам и прогрессу.</div>
              </div>
            </button>
          </article>
        ))}
      </div>
  </section>
);

const SectionsStage = ({
  courseTree,
  onOverrideOpenSection,
  onOpenSection,
  sectionOverrideBusyId,
}: {
  courseTree: TeacherStudentProfileCourseTree | null;
  onOverrideOpenSection: (sectionId: string) => void;
  onOpenSection: (sectionId: string) => void;
  sectionOverrideBusyId: string | null;
}) => (
  <section>
    {!courseTree || courseTree.sections.length === 0 ? (
      <div className={styles.empty}>В курсе нет опубликованных разделов.</div>
    ) : (
      <div className={styles.list}>
        {courseTree.sections.map((section) => {
          const sectionPendingCount = section.units.reduce((acc, unit) => acc + countPendingInUnit(unit), 0);
          return (
            <article key={section.id} className={`${styles.card} ${styles.rowCard} ${styles.clickableCard}`}>
              <button
                type="button"
                className={styles.cardPrimaryButton}
                onClick={() => onOpenSection(section.id)}
              >
                <div className={styles.cardBody}>
                  <div className={styles.cardTitle}>{section.title}</div>
                  <div className={styles.metaRow}>
                    Статус: {sectionAccessStatusLabel[section.state.accessStatus]}
                    <span className={styles.metaDot} aria-hidden="true">
                      •
                    </span>
                    Прогресс: {formatPercent(section.state.completionPercent)}
                    <span className={styles.metaDot} aria-hidden="true">
                      •
                    </span>
                    Юнитов: {section.units.length}
                    <span className={styles.metaDot} aria-hidden="true">
                      •
                    </span>
                    На проверке фото: {sectionPendingCount}
                  </div>
                </div>
              </button>
              <div className={styles.cardActionsRow}>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className={styles.inlineActionButton}
                  onClick={() => onOverrideOpenSection(section.id)}
                  disabled={sectionOverrideBusyId === section.id || section.state.accessStatus !== "locked"}
                >
                  {section.state.accessStatus !== "locked"
                    ? section.state.overrideOpened
                      ? "Раздел открыт"
                      : "Уже открыт"
                    : sectionOverrideBusyId === section.id
                      ? "Открываем…"
                      : "Открыть раздел"}
                </Button>
              </div>
            </article>
          );
        })}
      </div>
    )}
  </section>
);

const UnitsStage = ({
  onOpenUnit,
  onOverrideOpenUnit,
  overrideBusyUnitId,
  selectedSection,
}: {
  onOpenUnit: (unitId: string) => void;
  onOverrideOpenUnit: (unitId: string) => void;
  overrideBusyUnitId: string | null;
  selectedSection: TeacherStudentProfileSection | null;
}) => (
  <section>
    {!selectedSection || selectedSection.units.length === 0 ? (
      <div className={styles.empty}>В разделе нет опубликованных юнитов.</div>
    ) : (
      <div className={styles.unitsTableWrap}>
        <table className={styles.unitsTable}>
          <thead>
            <tr>
              <th scope="col">Юнит</th>
              <th scope="col">Статус</th>
              <th scope="col">Прогресс</th>
              <th scope="col">Решено</th>
              <th scope="col">Фото</th>
              <th scope="col" className={styles.unitsActionsHeader}>
                Действия
              </th>
            </tr>
          </thead>
          <tbody>
            {selectedSection.units.map((unit) => {
              const pendingPhotoCount = countPendingInUnit(unit);
              return (
                <tr key={unit.id}>
                  <td className={styles.unitTitleCell}>
                    <button type="button" className={styles.unitTitleButton} onClick={() => onOpenUnit(unit.id)}>
                      {unit.title}
                    </button>
                    {unit.state.overrideOpened ? (
                      <div className={styles.unitTitleMeta}>Открыт вручную</div>
                    ) : null}
                  </td>
                  <td className={styles.tableCenterCell}>
                    <span className={`${styles.statusBadge} ${styles[unitStatusClassName[unit.state.status]]}`}>
                      {getStudentUnitStatusLabel(unit.state.status)}
                    </span>
                  </td>
                  <td className={styles.tableCenterCell}>
                    <div className={styles.unitProgressCell}>
                      <div className={styles.progressTrack} aria-hidden="true">
                        <span
                          className={styles.progressFill}
                          style={{ width: `${Math.max(0, Math.min(unit.state.completionPercent, 100))}%` }}
                        />
                      </div>
                      <span className={styles.progressValue}>{formatPercent(unit.state.completionPercent)}</span>
                    </div>
                  </td>
                  <td
                    className={`${styles.tableCenterCell} ${
                      unit.state.solvedPercent >= 100 ? styles.solvedAccent : ""
                    }`}
                  >
                    {formatPercent(unit.state.solvedPercent)}
                  </td>
                  <td className={styles.tableCenterCell}>
                    {pendingPhotoCount > 0 ? (
                      <span className={`${styles.photoPendingFlag} ${styles.photoPendingStrong}`}>
                        {pendingPhotoCount}
                      </span>
                    ) : (
                      <span className={styles.tableMuted}>0</span>
                    )}
                  </td>
                  <td className={styles.unitActionsCell}>
                    {unit.state.status === "locked" ? (
                      <Button
                        variant="secondary"
                        size="sm"
                        className={styles.inlineActionButton}
                        onClick={() => onOverrideOpenUnit(unit.id)}
                        disabled={overrideBusyUnitId === unit.id || unit.state.overrideOpened}
                      >
                        {unit.state.overrideOpened
                          ? "Открыт"
                          : overrideBusyUnitId === unit.id
                            ? "Открываем…"
                            : "Открыть вручную"}
                      </Button>
                    ) : (
                      <span className={styles.tableMuted}>—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    )}
  </section>
);

const TasksStage = ({
  courseTree,
  creditBusyTaskId,
  onCreditTask,
  onOpenReviewInbox,
  onToggleTaskStatement,
  selectedCourse,
  selectedSection,
  selectedTaskId,
  selectedUnit,
}: {
  courseTree: TeacherStudentProfileCourseTree | null;
  creditBusyTaskId: string | null;
  onCreditTask: (task: TeacherStudentTreeTask) => void;
  onOpenReviewInbox: (params: ProfileContext) => void;
  onToggleTaskStatement: (taskId: string) => void;
  selectedCourse: TeacherStudentProfileDetails["courses"][number] | null;
  selectedSection: TeacherStudentProfileSection | null;
  selectedTaskId: string | null;
  selectedUnit: TeacherStudentTreeUnit | null;
}) => (
  <section>
    {!selectedUnit ? (
      <div className={styles.empty}>Юнит не найден.</div>
    ) : selectedUnit.tasks.length === 0 ? (
      <div className={styles.empty}>В этом юните нет опубликованных задач.</div>
    ) : (
      <div className={styles.tasksTableWrap}>
        <table className={styles.tasksTable}>
          <thead>
            <tr>
              <th scope="col" className={styles.tasksNumberHeader}>
                №
              </th>
              <th scope="col" className={styles.tasksTypeHeader}>
                Тип
              </th>
              <th scope="col" className={styles.tasksStatusHeader}>
                Статус
              </th>
              <th scope="col" className={styles.tasksAttemptsHeader}>
                Попытки
              </th>
              <th scope="col" className={styles.tasksPhotoHeader}>
                Фото
              </th>
              <th scope="col" className={styles.tasksActionsHeader}>
                Действия
              </th>
              <th scope="col" className={styles.tasksExpandHeader} />
            </tr>
          </thead>
          <tbody>
            {selectedUnit.tasks.map((task, index) => {
              const hasPendingPhoto = task.answerType === "photo" && task.pendingPhotoReviewCount > 0;
              const statementExpanded = selectedTaskId === task.id;
              const taskRowClassName = [
                statementExpanded ? styles.taskRowExpanded : "",
                task.isRequired ? styles.requiredTaskRow : "",
              ]
                .filter(Boolean)
                .join(" ");
              return (
                <Fragment key={task.id}>
                  <tr className={taskRowClassName || undefined}>
                    <td className={styles.taskNumberCell}>
                      <span className={styles.taskNumberValue}>{index + 1}</span>
                    </td>
                    <td className={styles.tableCenterCell}>
                      <span className={styles.answerTypeBadge}>{answerTypeLabel[task.answerType]}</span>
                    </td>
                    <td className={styles.tableCenterCell}>
                      <span className={`${styles.statusBadge} ${styles[statusClassName[task.state.status]]}`}>
                        {getStudentTaskStatusLabel(task.state.status)}
                      </span>
                    </td>
                    <td className={styles.tableCenterCell}>{task.state.attemptsUsed}</td>
                    <td className={styles.tableCenterCell}>
                      {hasPendingPhoto ? (
                        <button
                          type="button"
                          className={`${styles.photoPendingFlag} ${styles.photoPendingButton}`}
                          onClick={() =>
                            onOpenReviewInbox({
                              courseId: selectedCourse?.id ?? courseTree?.id,
                              sectionId: selectedSection?.id,
                              unitId: selectedUnit.id,
                              taskId: task.id,
                            })
                          }
                          title="Открыть проверку фото"
                        >
                          {task.pendingPhotoReviewCount}
                        </button>
                      ) : (
                        <span className={styles.tableMuted}>0</span>
                      )}
                    </td>
                    <td className={styles.taskActionsCell}>
                      <div className={styles.tableActions}>
                        {task.state.canTeacherCredit ? (
                          <Button
                            variant="secondary"
                            size="sm"
                            className={styles.inlineActionButton}
                            onClick={() => onCreditTask(task)}
                            disabled={creditBusyTaskId === task.id}
                          >
                            {creditBusyTaskId === task.id ? "Зачёт…" : "Зачесть"}
                          </Button>
                        ) : (
                          <span className={styles.tableMuted}>—</span>
                        )}
                      </div>
                    </td>
                    <td className={styles.statementToggleCell}>
                      <button
                        type="button"
                        className={styles.statementToggleButton}
                        onClick={() => onToggleTaskStatement(task.id)}
                        aria-label={statementExpanded ? "Скрыть условие" : "Показать условие"}
                        title={statementExpanded ? "Скрыть условие" : "Показать условие"}
                      >
                        {statementExpanded ? (
                          <ChevronDown className={styles.statementToggleIcon} aria-hidden="true" />
                        ) : (
                          <ChevronRight className={styles.statementToggleIcon} aria-hidden="true" />
                        )}
                      </button>
                    </td>
                  </tr>
                  {statementExpanded ? (
                    <tr className={styles.taskStatementRow}>
                      <td colSpan={7} className={styles.taskStatementCell}>
                        <LiteTex value={task.statementLite} block />
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    )}
  </section>
);

const StudentProfileContent = ({
  actionNotice,
  courseTree,
  creditBusyTaskId,
  error,
  details,
  handleCreditTask,
  handleOverrideOpenSection,
  handleOverrideOpenUnit,
  loading,
  openCourse,
  openReviewInbox,
  openSection,
  sectionOverrideBusyId,
  openUnit,
  overrideBusyUnitId,
  selectedCourse,
  selectedSection,
  selectedTaskId,
  selectedUnit,
  stage,
  toggleTaskStatement,
}: {
  actionNotice: string | null;
  courseTree: TeacherStudentProfileCourseTree | null;
  creditBusyTaskId: string | null;
  error: string | null;
  details: TeacherStudentProfileDetails | null;
  handleCreditTask: (task: TeacherStudentTreeTask) => void;
  handleOverrideOpenSection: (sectionId: string) => void;
  handleOverrideOpenUnit: (unitId: string) => void;
  loading: boolean;
  openCourse: (courseId: string) => void;
  openReviewInbox: (params?: ProfileContext) => void;
  openSection: (sectionId: string) => void;
  sectionOverrideBusyId: string | null;
  openUnit: (unitId: string) => void;
  overrideBusyUnitId: string | null;
  selectedCourse: TeacherStudentProfileDetails["courses"][number] | null;
  selectedSection: TeacherStudentProfileSection | null;
  selectedTaskId: string | null;
  selectedUnit: TeacherStudentTreeUnit | null;
  stage: "courses" | "sections" | "units" | "tasks";
  toggleTaskStatement: (taskId: string) => void;
}) => (
  <>
    {error ? (
      <div className={styles.error} role="status" aria-live="polite">
        {error}
      </div>
    ) : null}

    {actionNotice ? (
      <div className={styles.notice} role="status" aria-live="polite">
        {actionNotice}
      </div>
    ) : null}

    {loading ? <div className={styles.loading}>Загрузка структуры…</div> : null}

    {!loading && !details ? <div className={styles.empty}>Не удалось загрузить профиль ученика.</div> : null}

    {!loading && details ? (
      <>
        {stage === "courses" ? <CoursesStage courses={details.courses} onOpenCourse={openCourse} /> : null}
        {stage === "sections" ? (
          <SectionsStage
            courseTree={courseTree}
            onOpenSection={openSection}
            onOverrideOpenSection={handleOverrideOpenSection}
            sectionOverrideBusyId={sectionOverrideBusyId}
          />
        ) : null}
        {stage === "units" ? (
          <UnitsStage
            onOpenUnit={openUnit}
            onOverrideOpenUnit={handleOverrideOpenUnit}
            overrideBusyUnitId={overrideBusyUnitId}
            selectedSection={selectedSection}
          />
        ) : null}
        {stage === "tasks" ? (
          <TasksStage
            courseTree={courseTree}
            creditBusyTaskId={creditBusyTaskId}
            onCreditTask={handleCreditTask}
            onOpenReviewInbox={openReviewInbox}
            onToggleTaskStatement={toggleTaskStatement}
            selectedCourse={selectedCourse}
            selectedSection={selectedSection}
            selectedTaskId={selectedTaskId}
            selectedUnit={selectedUnit}
          />
        ) : null}
      </>
    ) : null}
  </>
);

function TeacherStudentProfilePanelRouteBoundary({
  studentId,
  fallbackName,
  onRefreshStudents,
}: Props) {
  const searchParams = useSearchParams();
  const searchParamsKey = searchParams.toString();
  const queryCourseId = searchParams.get("courseId")?.trim() || null;

  return (
    <TeacherStudentProfilePanelContent
      key={`${studentId}:${searchParamsKey}`}
      studentId={studentId}
      fallbackName={fallbackName}
      onRefreshStudents={onRefreshStudents}
      queryCourseId={queryCourseId}
      searchParams={searchParams}
    />
  );
}

function TeacherStudentProfilePanelContent({
  studentId,
  fallbackName,
  onRefreshStudents,
  queryCourseId,
  searchParams,
}: Props & {
  queryCourseId: string | null;
  searchParams: ReadonlyURLSearchParams;
}) {
  const router = useRouter();
  const [creditBusyTaskId, setCreditBusyTaskId] = useState<string | null>(null);
  const [sectionOverrideBusyId, setSectionOverrideBusyId] = useState<string | null>(null);
  const [overrideBusyUnitId, setOverrideBusyUnitId] = useState<string | null>(null);
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const detailsQuery = useQuery({
    queryKey: contentQueryKeys.teacherStudentProfile(studentId, queryCourseId),
    queryFn: () =>
      teacherApi.getStudentProfile(studentId, {
        courseId: queryCourseId ?? undefined,
      }),
  });
  const reviewPreviewQuery = useQuery({
    queryKey: contentQueryKeys.teacherStudentReviewPendingTotal(studentId),
    queryFn: async () => {
      const response = await teacherApi.listTeacherPhotoInbox({
        status: "pending_review",
        studentId,
        sort: "oldest",
        limit: 1,
        offset: 0,
      });
      return response.total;
    },
  });
  const details = detailsQuery.data ?? null;
  const reviewTotal = reviewPreviewQuery.data ?? 0;
  const loading = detailsQuery.isPending;
  const queryError = detailsQuery.isError ? formatApiErrorPayload(detailsQuery.error) : null;
  const error = actionError ?? queryError;
  const courseTree = details?.courseTree ?? null;

  const displayName = useMemo(
    () => getDisplayName(details?.profile.firstName, details?.profile.lastName, details?.profile.login, fallbackName),
    [details?.profile.firstName, details?.profile.lastName, details?.profile.login, fallbackName],
  );
  const reviewInboxHref = useMemo(() => {
    const search = buildReviewSearch({
      status: "pending_review",
      sort: "oldest",
      studentId,
    });
    return `/teacher/review${search ? `?${search}` : ""}`;
  }, [studentId]);
  const {
    activeCourseId,
    openCourse,
    openReviewInbox,
    openSection,
    openUnit,
    selectedCourse,
    selectedSection,
    selectedTaskId,
    selectedUnit,
    stage,
    toggleTaskStatement,
    goCoursesRoot,
    goSectionsRoot,
    goUnitsRoot,
    clearSelectedTask,
  } = useTeacherStudentProfileRouteState({
    courseTree,
    details,
    router,
    searchParams,
    studentId,
  });

  const { handleCreditTask, handleOverrideOpenSection, handleOverrideOpenUnit } = useTeacherStudentProfileActions({
    onRefreshStudents,
    setActionError,
    setActionNotice,
    setCreditBusyTaskId,
    setSectionOverrideBusyId,
    setOverrideBusyUnitId,
    studentId,
  });

  return (
    <section className={styles.panel}>
      <StudentProfileHeader
        details={details}
        displayName={displayName}
        reviewInboxHref={reviewInboxHref}
        reviewTotal={reviewTotal}
      />

      <section className={styles.drilldown}>
        <DrilldownHeader
          activeCourseId={activeCourseId}
          onClearSelectedTask={clearSelectedTask}
          onGoCoursesRoot={goCoursesRoot}
          onGoSectionsRoot={goSectionsRoot}
          onGoUnitsRoot={goUnitsRoot}
          selectedCourse={selectedCourse}
          selectedSection={selectedSection}
          selectedUnit={selectedUnit}
        />

        <StudentProfileContent
          actionNotice={actionNotice}
          courseTree={courseTree}
          creditBusyTaskId={creditBusyTaskId}
          details={details}
          error={error}
          handleCreditTask={(task) => void handleCreditTask(task, creditBusyTaskId)}
          handleOverrideOpenSection={(sectionId) =>
            void handleOverrideOpenSection(sectionId, Boolean(sectionOverrideBusyId))
          }
          handleOverrideOpenUnit={(unitId) =>
            void handleOverrideOpenUnit(unitId, Boolean(overrideBusyUnitId))
          }
          loading={loading}
          openCourse={openCourse}
          openReviewInbox={openReviewInbox}
          openSection={openSection}
          sectionOverrideBusyId={sectionOverrideBusyId}
          openUnit={openUnit}
          overrideBusyUnitId={overrideBusyUnitId}
          selectedCourse={selectedCourse}
          selectedSection={selectedSection}
          selectedTaskId={selectedTaskId}
          selectedUnit={selectedUnit}
          stage={stage}
          toggleTaskStatement={toggleTaskStatement}
        />
      </section>
    </section>
  );
}

export default function TeacherStudentProfilePanel(props: Props) {
  return (
    <Suspense
      fallback={
        <section className={styles.panel}>
          <div className={styles.empty}>Загрузка профиля ученика…</div>
        </section>
      }
    >
      <TeacherStudentProfilePanelRouteBoundary {...props} />
    </Suspense>
  );
}
