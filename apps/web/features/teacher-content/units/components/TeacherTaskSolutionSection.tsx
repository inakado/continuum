import dynamic from "next/dynamic";
import { type ComponentProps } from "react";
import Button from "@/components/ui/Button";
import type PdfCanvasPreviewComponent from "@/components/PdfCanvasPreview";
import type { Task } from "@/lib/api/teacher";
import type { TaskSolutionCompileState } from "../hooks/use-teacher-unit-latex-compile";
import styles from "../teacher-unit-detail.module.css";

type PdfCanvasPreviewProps = ComponentProps<typeof PdfCanvasPreviewComponent>;

const PdfCanvasPreview = dynamic<PdfCanvasPreviewProps>(() => import("@/components/PdfCanvasPreview"), {
  ssr: false,
  loading: () => <div className={styles.previewStub}>Загрузка PDF...</div>,
});

type Props = {
  editingTask: Task | null;
  solutionLatex: string;
  onSolutionLatexChange: (value: string) => void;
  compileState: TaskSolutionCompileState;
  onCompile: () => Promise<void>;
  showOpenLogAction: boolean;
  onOpenCompileLog: () => void;
  getFreshPreviewUrl: () => Promise<string | null>;
};

export function TeacherTaskSolutionSection({
  editingTask,
  solutionLatex,
  onSolutionLatexChange,
  compileState,
  onCompile,
  showOpenLogAction,
  onOpenCompileLog,
  getFreshPreviewUrl,
}: Props) {
  return (
    <div className={styles.taskSolutionSection}>
      <div className={styles.taskSolutionHeader}>
        <div className={styles.taskSolutionTitle}>Решение (LaTeX → PDF)</div>
        {editingTask ? (
          <Button
            type="button"
            variant="ghost"
            onClick={() => void onCompile()}
            disabled={compileState.loading}
          >
            {compileState.loading ? "Компиляция..." : "Скомпилировать PDF"}
          </Button>
        ) : null}
      </div>

      {editingTask ? (
        <div className={styles.taskSolutionGrid}>
          <div className={styles.taskSolutionEditor}>
            <textarea
              className={styles.taskSolutionTextarea}
              value={solutionLatex}
              onChange={(event) => onSolutionLatexChange(event.target.value)}
              aria-label="LaTeX решения"
              placeholder="\\documentclass{article}\n\\begin{document}\nРешение...\n\\end{document}"
            />
          </div>
          <div className={styles.taskSolutionRight}>
            {compileState.error ? (
              <div className={styles.compileError} role="status" aria-live="polite">
                <span>{compileState.error}</span>
                {showOpenLogAction ? (
                  <button type="button" className={styles.compileErrorAction} onClick={onOpenCompileLog}>
                    Открыть лог
                  </button>
                ) : null}
              </div>
            ) : null}
            <div className={styles.taskSolutionViewportWrap}>
              {compileState.updatedAt ? (
                <div className={styles.taskSolutionMeta}>
                  PDF обновлён: {new Date(compileState.updatedAt).toLocaleString("ru-RU")}
                </div>
              ) : null}
              <div className={styles.taskSolutionViewport}>
                {compileState.previewUrl ? (
                  <PdfCanvasPreview
                    className={styles.taskSolutionFrame}
                    url={compileState.previewUrl}
                    refreshKey={compileState.key ?? undefined}
                    getFreshUrl={getFreshPreviewUrl}
                    scrollFeel="inertial-heavy"
                    freezeWidth
                  />
                ) : (
                  <div className={styles.previewStub}>PDF появится здесь после компиляции.</div>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className={styles.taskSolutionStub}>
          Сначала создайте задачу, затем откройте её редактирование для сборки PDF-решения.
        </div>
      )}
    </div>
  );
}
