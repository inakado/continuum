"use client";

import {
  type Dispatch,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type SetStateAction,
} from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Trash2 } from "lucide-react";
import { EditorView } from "@codemirror/view";
import { StreamLanguage } from "@codemirror/language";
import { stex } from "@codemirror/legacy-modes/mode/stex";
import DashboardShell from "@/components/DashboardShell";
import AlertDialog from "@/components/ui/AlertDialog";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Switch from "@/components/ui/Switch";
import Tabs from "@/components/ui/Tabs";
import type { Task, UnitVideo } from "@/lib/api/teacher";
import { useTeacherLogout } from "../auth/use-teacher-logout";
import { useTeacherIdentity } from "../shared/use-teacher-identity";
import styles from "./teacher-unit-detail.module.css";
import { useTeacherUnitLatexCompile } from "./hooks/use-teacher-unit-latex-compile";
import { useTeacherTaskStatementImage } from "./hooks/use-teacher-task-statement-image";
import { useTeacherUnitFetchSave } from "./hooks/use-teacher-unit-fetch-save";
import {
  useTeacherUnitScreenActions,
  type DeleteConfirmState,
} from "./hooks/use-teacher-unit-screen-actions";
import { TeacherUnitLatexPanel } from "./components/TeacherUnitLatexPanel";
import { TeacherCompileErrorDialog } from "./components/TeacherCompileErrorDialog";
import { TeacherTaskStatementImageSection } from "./components/TeacherTaskStatementImageSection";
import { TeacherTaskSolutionSection } from "./components/TeacherTaskSolutionSection";
import { TeacherUnitTasksPanel } from "./components/TeacherUnitTasksPanel";

type Props = {
  unitId: string;
};

type TabKey = "theory" | "method" | "tasks" | "video" | "attachments";

const clampPreviewWidth = (value: number) => Math.min(60, Math.max(25, Math.round(value)));

const getVideoFactory = (): UnitVideo => ({
  id: crypto.randomUUID(),
  title: "",
  embedUrl: "",
});

function TeacherUnitHeader({
  courseTitle,
  sectionTitle,
  unitTitle,
  isPublished,
  isDeletingUnit,
  saveStatusText,
  onBackToSection,
  onBackToCourses,
  onTogglePublish,
  onDeleteUnit,
}: {
  courseTitle: string | null;
  sectionTitle: string | null;
  unitTitle: string;
  isPublished: boolean;
  isDeletingUnit: boolean;
  saveStatusText: string;
  onBackToSection: () => void;
  onBackToCourses: () => void;
  onTogglePublish: () => void;
  onDeleteUnit: () => void;
}) {
  return (
    <div className={styles.header}>
      <div className={styles.headerTop}>
        <nav className={styles.breadcrumbs} aria-label="Навигация">
          <button
            type="button"
            className={styles.breadcrumbIconButton}
            onClick={onBackToSection}
            aria-label="Назад к разделу"
          >
            <ArrowLeft size={18} />
          </button>
          <button type="button" className={styles.breadcrumbLink} onClick={onBackToCourses}>
            Курсы
          </button>
          <span className={styles.breadcrumbDivider}>/</span>
          <button type="button" className={styles.breadcrumbLink} onClick={onBackToSection}>
            {courseTitle ?? sectionTitle ?? "Раздел"}
          </button>
          <span className={styles.breadcrumbDivider}>/</span>
          <span className={styles.breadcrumbCurrent} aria-current="page">
            {unitTitle}
          </span>
        </nav>
        <div className={styles.headerActions}>
          <Switch
            className={styles.publishToggle}
            checked={isPublished}
            onCheckedChange={onTogglePublish}
            label="Опубликовано"
          />
          <Button
            variant="ghost"
            onClick={onDeleteUnit}
            disabled={isDeletingUnit}
            className={styles.deleteUnitButton}
          >
            <Trash2 size={18} />
            {isDeletingUnit ? "Удаление..." : "Удалить юнит"}
          </Button>
          {saveStatusText ? (
            <div className={styles.saveStatus} role="status" aria-live="polite">
              {saveStatusText}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function TeacherUnitVideoPanel({
  videos,
  setVideos,
}: {
  videos: UnitVideo[];
  setVideos: Dispatch<SetStateAction<UnitVideo[]>>;
}) {
  return (
    <div className={styles.videoPanel}>
      <div className={styles.videoHeader}>
        <div>
          <div className={styles.kicker}>Видео</div>
          <div className={styles.hint}>Ссылки сохраняются автоматически</div>
        </div>
        <Button onClick={() => setVideos((prev) => [...prev, getVideoFactory()])}>Добавить видео</Button>
      </div>

      {videos.length === 0 ? (
        <div className={styles.previewStub}>Видео пока не добавлены.</div>
      ) : (
        <div className={styles.videoList}>
          {videos.map((video, index) => (
            <div key={video.id} className={styles.videoCard}>
              <label className={styles.label}>
                Название
                <Input
                  value={video.title}
                  name={`videoTitle-${index}`}
                  autoComplete="off"
                  onChange={(event) =>
                    setVideos((prev) =>
                      prev.map((item) =>
                        item.id === video.id ? { ...item, title: event.target.value } : item,
                      ),
                    )
                  }
                />
              </label>
              <label className={styles.label}>
                Embed URL
                <Input
                  value={video.embedUrl}
                  name={`videoUrl-${index}`}
                  autoComplete="off"
                  onChange={(event) =>
                    setVideos((prev) =>
                      prev.map((item) =>
                        item.id === video.id ? { ...item, embedUrl: event.target.value } : item,
                      ),
                    )
                  }
                />
              </label>
              <div className={styles.videoActions}>
                <Button variant="ghost" onClick={() => setVideos((prev) => prev.filter((item) => item.id !== video.id))}>
                  Удалить
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function TeacherUnitDeleteDialog({
  state,
  isDeletingUnit,
  onOpenChange,
  onConfirm,
}: {
  state: DeleteConfirmState;
  isDeletingUnit: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}) {
  return (
    <AlertDialog
      open={Boolean(state)}
      onOpenChange={onOpenChange}
      title={
        state?.kind === "task"
          ? "Удалить задачу? Действие нельзя отменить."
          : state?.kind === "unit"
            ? `Удалить юнит «${state.unitTitle}»?`
            : ""
      }
      description={
        state?.kind === "task"
          ? "Задача будет удалена без возможности восстановления."
          : state?.kind === "unit"
            ? "Будут удалены все задачи внутри юнита. Действие нельзя отменить."
            : ""
      }
      confirmText={state?.kind === "unit" ? "Удалить юнит" : "Удалить задачу"}
      cancelText="Отмена"
      destructive
      confirmDisabled={isDeletingUnit}
      onConfirm={onConfirm}
    />
  );
}

function useTeacherUnitEditorLayout() {
  const optionalMinInputRef = useRef<HTMLInputElement | null>(null);
  const editorGridRef = useRef<HTMLDivElement | null>(null);
  const [previewWidthPercent, setPreviewWidthPercent] = useState(38);
  const [isResizingLayout, setIsResizingLayout] = useState(false);

  const editorGridStyle = useMemo(
    () =>
      ({
        "--editor-fr": `${100 - previewWidthPercent}fr`,
        "--preview-fr": `${previewWidthPercent}fr`,
        "--splitter-left": `${100 - previewWidthPercent}%`,
      }) as CSSProperties,
    [previewWidthPercent],
  );

  const updateLayoutRatioFromPointer = useCallback((clientX: number) => {
    const grid = editorGridRef.current;
    if (!grid) return;

    const rect = grid.getBoundingClientRect();
    if (rect.width <= 0) return;

    const pointerOffset = clientX - rect.left;
    const nextPreviewPercent = ((rect.width - pointerOffset) / rect.width) * 100;
    setPreviewWidthPercent(clampPreviewWidth(nextPreviewPercent));
  }, []);

  const handleSplitterPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (event.button !== 0) return;
      event.preventDefault();
      setIsResizingLayout(true);
      updateLayoutRatioFromPointer(event.clientX);
    },
    [updateLayoutRatioFromPointer],
  );

  const handleSplitterKeyDown = useCallback((event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      setPreviewWidthPercent((prev) => clampPreviewWidth(prev + 2));
    }
    if (event.key === "ArrowRight") {
      event.preventDefault();
      setPreviewWidthPercent((prev) => clampPreviewWidth(prev - 2));
    }
  }, []);

  useEffect(() => {
    if (!isResizingLayout) return;

    const handlePointerMove = (event: PointerEvent) => {
      updateLayoutRatioFromPointer(event.clientX);
    };
    const stopResizing = () => setIsResizingLayout(false);

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", stopResizing);
    window.addEventListener("pointercancel", stopResizing);
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", stopResizing);
      window.removeEventListener("pointercancel", stopResizing);
    };
  }, [isResizingLayout, updateLayoutRatioFromPointer]);

  return {
    optionalMinInputRef,
    editorGridRef,
    previewWidthPercent,
    isResizingLayout,
    editorGridStyle,
    handleSplitterPointerDown,
    handleSplitterKeyDown,
  };
}

function TeacherUnitTabContent({
  activeTab,
  unit,
  taskOrder,
  theoryText,
  setTheoryText,
  methodText,
  setMethodText,
  videos,
  setVideos,
  compile,
  statementImage,
  actions,
  layout,
  latexExtensions,
  minCountedInput,
  progressSaveState,
}: {
  activeTab: TabKey;
  unit: ReturnType<typeof useTeacherUnitFetchSave>["unit"];
  taskOrder: Task[];
  theoryText: string;
  setTheoryText: Dispatch<SetStateAction<string>>;
  methodText: string;
  setMethodText: Dispatch<SetStateAction<string>>;
  videos: UnitVideo[];
  setVideos: Dispatch<SetStateAction<UnitVideo[]>>;
  compile: ReturnType<typeof useTeacherUnitLatexCompile>;
  statementImage: ReturnType<typeof useTeacherTaskStatementImage>;
  actions: ReturnType<typeof useTeacherUnitScreenActions>;
  layout: ReturnType<typeof useTeacherUnitEditorLayout>;
  latexExtensions: unknown[];
  minCountedInput: string;
  progressSaveState: ReturnType<typeof useTeacherUnitFetchSave>["progressSaveState"];
}) {
  if (activeTab === "theory" || activeTab === "method") {
    const target = activeTab;
    const title = target === "theory" ? "Теория" : "Методика";
    const compileState = compile.compileState[target];
    const previewUrl = compile.previewUrls[target];
    const refreshKey =
      compile.compileState[target].key ??
      (target === "theory" ? unit?.theoryPdfAssetKey : unit?.methodPdfAssetKey) ??
      undefined;
    const getFreshUrl = target === "theory" ? compile.refreshTheoryPreviewUrl : compile.refreshMethodPreviewUrl;
    const onCompile = () => void compile.runCompile(target);
    const showOpenLogAction =
      compileState.error === "Компиляция не удалась. Откройте лог." &&
      compile.compileErrorModalState?.target === target;
    const onOpenCompileLog = () => compile.reopenCompileErrorModal(target);

    return (
      <TeacherUnitLatexPanel
        title={title}
        value={target === "theory" ? theoryText : methodText}
        onChange={target === "theory" ? setTheoryText : setMethodText}
        editorExtensions={latexExtensions}
        editorGridRef={layout.editorGridRef}
        editorGridStyle={layout.editorGridStyle}
        isResizingLayout={layout.isResizingLayout}
        minPreviewWidthPercent={25}
        maxPreviewWidthPercent={60}
        previewWidthPercent={layout.previewWidthPercent}
        onSplitterPointerDown={layout.handleSplitterPointerDown}
        onSplitterKeyDown={layout.handleSplitterKeyDown}
        compileState={compileState}
        onCompile={onCompile}
        showOpenLogAction={showOpenLogAction}
        onOpenCompileLog={onOpenCompileLog}
        previewUrl={previewUrl}
        refreshKey={refreshKey}
        getFreshUrl={getFreshUrl}
      />
    );
  }

  if (activeTab === "video") {
    return <TeacherUnitVideoPanel videos={videos} setVideos={setVideos} />;
  }

  if (activeTab === "attachments") {
    return <div className={styles.previewStub}>Вложения будут добавлены позже.</div>;
  }

  return (
    <TeacherUnitTasksPanel
      requiredTasksCount={actions.requiredTasksCount}
      hasSavedOptionalMin={actions.hasSavedOptionalMin}
      isOptionalMinEditing={actions.optionalMinEditing.isOptionalMinEditing}
      optionalMinInputRef={layout.optionalMinInputRef}
      minCountedInput={minCountedInput}
      onMinCountedInputChange={actions.optionalMinEditing.onMinCountedInputChange}
      savedOptionalMin={actions.savedOptionalMin ?? 0}
      totalToComplete={actions.totalToComplete}
      progressSaveState={progressSaveState}
      progressStatusText={actions.progressStatusText}
      onStartOptionalEdit={actions.optionalMinEditing.onStartOptionalEdit}
      onFinishOptionalEdit={actions.optionalMinEditing.onFinishOptionalEdit}
      onCancelOptionalEdit={actions.optionalMinEditing.onCancelOptionalEdit}
      onSaveOptionalMin={actions.optionalMinEditing.onSaveOptionalMin}
      creatingTask={actions.creatingTask}
      editingTask={actions.editingTask}
      creatingTaskPublish={actions.creatingTaskPublish}
      onCreatingTaskPublishChange={actions.setCreatingTaskPublish}
      onStartCreateTask={actions.taskFormFlow.onStartCreateTask}
      onCancelTaskForm={actions.taskFormFlow.onCancelTaskForm}
      formError={actions.formError}
      taskOrderStatus={actions.taskOrderStatus}
      taskOrder={taskOrder}
      onReorderTasks={(nextOrder, previousOrder) => {
        actions.persistTaskOrder(nextOrder, previousOrder);
      }}
      onTaskEdit={actions.handleTaskEdit}
      onTaskDelete={actions.handleTaskDelete}
      editingTaskNumber={actions.editingTaskNumber}
      nextTaskOrder={actions.nextTaskOrder}
      taskFormInitial={actions.taskFormInitial}
      onTaskSubmit={actions.handleTaskSubmit}
      onTaskUpdate={actions.handleTaskUpdate}
      onTaskPublishToggle={actions.handleTaskPublishToggle}
      afterStatementSection={
        <TeacherTaskStatementImageSection
          editingTask={actions.editingTask}
          inputRef={statementImage.taskStatementImageInputRef}
          state={statementImage.taskStatementImageState}
          statusText={statementImage.taskStatementImageStatusText}
          onSelect={statementImage.handleTaskStatementImageSelected}
          onRemove={statementImage.handleTaskStatementImageRemove}
          onPreviewError={statementImage.handleTaskStatementImagePreviewError}
        />
      }
      extraSection={
        <TeacherTaskSolutionSection
          editingTask={actions.editingTask}
          solutionLatex={compile.taskSolutionLatex}
          onSolutionLatexChange={compile.setTaskSolutionLatex}
          compileState={compile.taskSolutionCompileState}
          onCompile={compile.runTaskSolutionCompile}
          showOpenLogAction={
            compile.taskSolutionCompileState.error === "Компиляция не удалась. Откройте лог." &&
            compile.compileErrorModalState?.target === "task_solution"
          }
          onOpenCompileLog={() => compile.reopenCompileErrorModal("task_solution")}
          getFreshPreviewUrl={compile.refreshTaskSolutionPreviewUrl}
        />
      }
    />
  );
}

export default function TeacherUnitDetailScreen({ unitId }: Props) {
  const tabsId = useId();
  const router = useRouter();
  const handleLogout = useTeacherLogout();
  const identity = useTeacherIdentity();

  const fetchSave = useTeacherUnitFetchSave({ unitId });
  const [activeTab, setActiveTab] = useState<TabKey>("theory");
  const layout = useTeacherUnitEditorLayout();

  useEffect(() => {
    if (!fetchSave.isOptionalMinEditing) return;
    layout.optionalMinInputRef.current?.focus();
    layout.optionalMinInputRef.current?.select();
  }, [fetchSave.isOptionalMinEditing, layout.optionalMinInputRef]);

  const actions = useTeacherUnitScreenActions({
    unit: fetchSave.unit,
    setUnit: fetchSave.setUnit,
    taskOrder: fetchSave.taskOrder,
    setTaskOrder: fetchSave.setTaskOrder,
    fetchUnit: fetchSave.fetchUnit,
    setError: fetchSave.setError,
    saveState: fetchSave.saveState,
    progressSaveState: fetchSave.progressSaveState,
    minCountedInput: fetchSave.minCountedInput,
    setMinCountedInput: fetchSave.setMinCountedInput,
    isOptionalMinEditing: fetchSave.isOptionalMinEditing,
    setIsOptionalMinEditing: fetchSave.setIsOptionalMinEditing,
    handleProgressSave: fetchSave.handleProgressSave,
    setProgressSaveState: fetchSave.setProgressSaveState,
    router,
  });

  const compileWithEditingTask = useTeacherUnitLatexCompile({
    unit: fetchSave.unit,
    setUnit: fetchSave.setUnit,
    theoryText: fetchSave.theoryText,
    methodText: fetchSave.methodText,
    editingTask: actions.editingTask,
    fetchUnit: fetchSave.fetchUnit,
  });

  const statementImage = useTeacherTaskStatementImage({
    editingTask: actions.editingTask,
    fetchUnit: fetchSave.fetchUnit,
  });

  const navItems = useMemo(
    () => [
      { label: "Курсы", href: "/teacher", active: true },
      { label: "Ученики", href: "/teacher/students" },
      { label: "Проверка фото", href: "/teacher/review" },
      { label: "Аналитика", href: "/teacher/analytics" },
    ],
    [],
  );

  const tabs = useMemo(
    () => [
      { key: "theory" as const, label: "Теория" },
      { key: "method" as const, label: "Методика" },
      { key: "tasks" as const, label: "Задачи" },
      { key: "video" as const, label: "Видео" },
      { key: "attachments" as const, label: "Вложения" },
    ],
    [],
  );

  const latexExtensions = useMemo(() => [StreamLanguage.define(stex), EditorView.lineWrapping], []);
  const activePanelId = `${tabsId}-${activeTab}-panel`;
  const activeTabId = `${tabsId}-${activeTab}`;

  return (
    <DashboardShell
      title={identity.displayName || "Преподаватель"}
      navItems={navItems}
      appearance="glass"
      onLogout={handleLogout}
      settingsHref="/teacher/settings"
    >
      <div className={styles.content}>
        <TeacherUnitHeader
          courseTitle={fetchSave.courseTitle}
          sectionTitle={fetchSave.sectionTitle}
          unitTitle={fetchSave.unit?.title ?? "Юнит"}
          isPublished={fetchSave.unit?.status === "published"}
          isDeletingUnit={actions.isDeletingUnit}
          saveStatusText={actions.saveStatusText}
          onBackToSection={actions.handleBackToSection}
          onBackToCourses={actions.handleBackToCourses}
          onTogglePublish={() => void actions.handleUnitPublishToggle()}
          onDeleteUnit={actions.handleUnitDelete}
        />

        {fetchSave.error ? (
          <div className={styles.error} role="status" aria-live="polite">
            {fetchSave.error}
          </div>
        ) : null}

        <div className={styles.tabsRow}>
          <Tabs
            idBase={tabsId}
            tabs={tabs}
            active={activeTab}
            onChange={setActiveTab}
            ariaLabel="Вкладки юнита"
            className={styles.unitTabs}
          />
        </div>

        <div id={activePanelId} role="tabpanel" aria-labelledby={activeTabId}>
          <TeacherUnitTabContent
            activeTab={activeTab}
            unit={fetchSave.unit}
            taskOrder={fetchSave.taskOrder}
            theoryText={fetchSave.theoryText}
            setTheoryText={fetchSave.setTheoryText}
            methodText={fetchSave.methodText}
            setMethodText={fetchSave.setMethodText}
            videos={fetchSave.videos}
            setVideos={fetchSave.setVideos}
            compile={compileWithEditingTask}
            statementImage={statementImage}
            actions={actions}
            layout={layout}
            latexExtensions={latexExtensions}
            minCountedInput={fetchSave.minCountedInput}
            progressSaveState={fetchSave.progressSaveState}
          />
        </div>
      </div>

      <TeacherCompileErrorDialog
        state={compileWithEditingTask.compileErrorModalState}
        open={compileWithEditingTask.isCompileErrorModalOpen}
        onOpenChange={compileWithEditingTask.setIsCompileErrorModalOpen}
        onCopy={compileWithEditingTask.copyCompileErrorLog}
        onClose={compileWithEditingTask.closeCompileErrorModal}
        copyState={compileWithEditingTask.compileErrorCopyState}
        logHint={compileWithEditingTask.compileErrorLogHint}
      />

      <TeacherUnitDeleteDialog
        state={actions.deleteConfirmState}
        isDeletingUnit={actions.isDeletingUnit}
        onOpenChange={(open) => {
          if (!open) actions.setDeleteConfirmState(null);
        }}
        onConfirm={() => void actions.handleConfirmDelete()}
      />
    </DashboardShell>
  );
}
