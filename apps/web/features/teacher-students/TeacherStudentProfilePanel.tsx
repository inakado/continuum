"use client";

import { useQuery } from "@tanstack/react-query";
import { Fragment, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
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

const formatPercent = (value: number) => `${Math.round(value)}%`;

const countPendingInUnit = (unit: TeacherStudentTreeUnit) =>
  unit.tasks.reduce((acc, task) => acc + task.pendingPhotoReviewCount, 0);

const StudentProfileHeader = ({
  details,
  displayName,
  onOpenReviewInbox,
  reviewTotal,
}: {
  details: TeacherStudentProfileDetails | null;
  displayName: string;
  onOpenReviewInbox: () => void;
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
      <Button
        variant="ghost"
        className={styles.reviewQueueButton}
        data-pending={reviewTotal > 0 ? "true" : "false"}
        onClick={onOpenReviewInbox}
      >
        Фото на проверке: {reviewTotal}
      </Button>
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
        <article
          key={course.id}
          className={`${styles.card} ${styles.clickableCard}`}
          onClick={() => onOpenCourse(course.id)}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              onOpenCourse(course.id);
            }
          }}
          role="button"
          tabIndex={0}
        >
          <div className={styles.cardTitle}>{course.title}</div>
          <div className={styles.metaRow}>Откройте курс, чтобы посмотреть разделы и юниты.</div>
        </article>
      ))}
    </div>
  </section>
);

const SectionsStage = ({
  courseTree,
  onOpenSection,
}: {
  courseTree: TeacherStudentProfileCourseTree | null;
  onOpenSection: (sectionId: string) => void;
}) => (
  <section>
    {!courseTree || courseTree.sections.length === 0 ? (
      <div className={styles.empty}>В курсе нет опубликованных разделов.</div>
    ) : (
      <div className={styles.list}>
        {courseTree.sections.map((section) => {
          const sectionPendingCount = section.units.reduce((acc, unit) => acc + countPendingInUnit(unit), 0);
          return (
            <article
              key={section.id}
              className={`${styles.card} ${styles.clickableCard}`}
              onClick={() => onOpenSection(section.id)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onOpenSection(section.id);
                }
              }}
              role="button"
              tabIndex={0}
            >
              <div className={styles.cardTitle}>{section.title}</div>
              <div className={styles.metaRow}>Юнитов: {section.units.length}</div>
              <div className={styles.metaRow}>На проверке фото: {sectionPendingCount}</div>
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
                        variant="ghost"
                        className={`${styles.inlineActionButton} ${styles.inlineActionAccent}`}
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
    <p className={styles.stageSubtitle}>Задачи юнита: {selectedUnit?.title ?? "-"}</p>
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
                            variant="ghost"
                            className={`${styles.inlineActionButton} ${styles.inlineActionAccent}`}
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
  handleOverrideOpenUnit,
  loading,
  openCourse,
  openReviewInbox,
  openSection,
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
  handleOverrideOpenUnit: (unitId: string) => void;
  loading: boolean;
  openCourse: (courseId: string) => void;
  openReviewInbox: (params?: ProfileContext) => void;
  openSection: (sectionId: string) => void;
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
        {stage === "sections" ? <SectionsStage courseTree={courseTree} onOpenSection={openSection} /> : null}
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

export default function TeacherStudentProfilePanel({
  studentId,
  fallbackName,
  onRefreshStudents,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [creditBusyTaskId, setCreditBusyTaskId] = useState<string | null>(null);
  const [overrideBusyUnitId, setOverrideBusyUnitId] = useState<string | null>(null);
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const queryCourseId = useMemo(() => searchParams.get("courseId")?.trim() || null, [searchParams]);
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

  useEffect(() => {
    setActionNotice(null);
    setActionError(null);
  }, [queryCourseId, searchParams, studentId]);

  const displayName = useMemo(
    () => getDisplayName(details?.profile.firstName, details?.profile.lastName, details?.profile.login, fallbackName),
    [details?.profile.firstName, details?.profile.lastName, details?.profile.login, fallbackName],
  );
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

  const { handleCreditTask, handleOverrideOpenUnit } = useTeacherStudentProfileActions({
    onRefreshStudents,
    setActionError,
    setActionNotice,
    setCreditBusyTaskId,
    setOverrideBusyUnitId,
    studentId,
  });

  return (
    <section className={styles.panel}>
      <StudentProfileHeader
        details={details}
        displayName={displayName}
        onOpenReviewInbox={() => openReviewInbox()}
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
          handleOverrideOpenUnit={(unitId) =>
            void handleOverrideOpenUnit(unitId, Boolean(overrideBusyUnitId))
          }
          loading={loading}
          openCourse={openCourse}
          openReviewInbox={openReviewInbox}
          openSection={openSection}
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
