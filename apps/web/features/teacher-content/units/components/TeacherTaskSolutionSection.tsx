import { useEffect, useRef } from "react";
import Button from "@/components/ui/Button";
import type { Task } from "@/lib/api/teacher";
import type { TaskSolutionCompileState } from "../hooks/use-teacher-unit-latex-compile";
import { typesetMathInElement } from "../../../student-content/units/mathjax-helper";
import styles from "../teacher-unit-detail.module.css";

type Props = {
  editingTask: Task | null;
  solutionLatex: string;
  onSolutionLatexChange: (value: string) => void;
  compileState: TaskSolutionCompileState;
  onCompile: () => Promise<void>;
  showOpenLogAction: boolean;
  onOpenCompileLog: () => void;
};

export function TeacherTaskSolutionSection({
  editingTask,
  solutionLatex,
  onSolutionLatexChange,
  compileState,
  onCompile,
  showOpenLogAction,
  onOpenCompileLog,
}: Props) {
  const htmlContentRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!compileState.previewHtml || !htmlContentRef.current) return;
    void typesetMathInElement(htmlContentRef.current).catch(() => {
      // Teacher preview остаётся читаемым и без typesetting.
    });
  }, [compileState.previewHtml, compileState.key]);

  return (
    <div className={styles.taskSolutionSection}>
      <div className={styles.taskSolutionHeader}>
        <div className={styles.taskSolutionTitle}>Решение (LaTeX → HTML)</div>
        {editingTask ? (
          <Button
            type="button"
            variant="ghost"
            onClick={() => void onCompile()}
            disabled={compileState.loading}
          >
            {compileState.loading ? "Компиляция..." : "Скомпилировать HTML"}
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
                  HTML обновлён: {new Date(compileState.updatedAt).toLocaleString("ru-RU")}
                </div>
              ) : null}
              <div className={styles.taskSolutionViewport}>
                {compileState.previewHtml ? (
                  <div
                    ref={htmlContentRef}
                    className={styles.taskSolutionHtmlContent}
                    dangerouslySetInnerHTML={{ __html: compileState.previewHtml }}
                  />
                ) : (
                  <div className={styles.previewStub}>HTML появится здесь после компиляции.</div>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className={styles.taskSolutionStub}>
          Сначала создайте задачу, затем откройте её редактирование для сборки HTML-решения.
        </div>
      )}
    </div>
  );
}
