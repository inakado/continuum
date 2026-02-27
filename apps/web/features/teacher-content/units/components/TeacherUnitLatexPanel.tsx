import dynamic from "next/dynamic";
import {
  type CSSProperties,
  type ComponentProps,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
} from "react";
import Button from "@/components/ui/Button";
import type { CompileState } from "../hooks/use-teacher-unit-latex-compile";
import styles from "../teacher-unit-detail.module.css";

type CodeMirrorProps = ComponentProps<typeof import("@uiw/react-codemirror").default>;
type PdfCanvasPreviewProps = ComponentProps<typeof import("@/components/PdfCanvasPreview").default>;

const CodeMirror = dynamic<CodeMirrorProps>(() => import("@uiw/react-codemirror"), {
  ssr: false,
  loading: () => <div className={styles.editorLoading}>Загрузка редактора…</div>,
});

const PdfCanvasPreview = dynamic<PdfCanvasPreviewProps>(() => import("@/components/PdfCanvasPreview"), {
  ssr: false,
  loading: () => <div className={styles.previewStub}>Загрузка PDF...</div>,
});

type Props = {
  title: string;
  value: string;
  onChange: (value: string) => void;
  editorExtensions: CodeMirrorProps["extensions"];
  editorGridRef: RefObject<HTMLDivElement | null>;
  editorGridStyle: CSSProperties;
  isResizingLayout: boolean;
  minPreviewWidthPercent: number;
  maxPreviewWidthPercent: number;
  previewWidthPercent: number;
  onSplitterPointerDown: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onSplitterKeyDown: (event: ReactKeyboardEvent<HTMLDivElement>) => void;
  compileState: CompileState;
  onCompile: () => void;
  showOpenLogAction: boolean;
  onOpenCompileLog: () => void;
  previewUrl: string | null;
  refreshKey?: string;
  getFreshUrl: () => Promise<string | null>;
};

export function TeacherUnitLatexPanel({
  title,
  value,
  onChange,
  editorExtensions,
  editorGridRef,
  editorGridStyle,
  isResizingLayout,
  minPreviewWidthPercent,
  maxPreviewWidthPercent,
  previewWidthPercent,
  onSplitterPointerDown,
  onSplitterKeyDown,
  compileState,
  onCompile,
  showOpenLogAction,
  onOpenCompileLog,
  previewUrl,
  refreshKey,
  getFreshUrl,
}: Props) {
  return (
    <div
      ref={editorGridRef}
      className={`${styles.editorGrid} ${isResizingLayout ? styles.editorGridResizing : ""}`}
      style={editorGridStyle}
    >
      <div className={styles.editorPanel}>
        <div className={styles.kicker}>{title}</div>
        <CodeMirror
          className={styles.codeEditor}
          value={value}
          height="100%"
          onChange={onChange}
          extensions={editorExtensions}
        />
      </div>
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label="Изменить ширину редактора и предпросмотра"
        aria-valuemin={minPreviewWidthPercent}
        aria-valuemax={maxPreviewWidthPercent}
        aria-valuenow={previewWidthPercent}
        tabIndex={0}
        className={`${styles.editorSplitter} ${isResizingLayout ? styles.editorSplitterActive : ""}`}
        onPointerDown={onSplitterPointerDown}
        onKeyDown={onSplitterKeyDown}
      />
      <div className={styles.previewPanel}>
        <div className={styles.kicker}>Предпросмотр</div>
        <div className={styles.previewActions}>
          <Button onClick={onCompile} disabled={compileState.loading}>
            {compileState.loading ? "Компиляция..." : "Скомпилировать PDF"}
          </Button>
        </div>
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
        {compileState.updatedAt ? (
          <div className={styles.compileMeta}>
            PDF обновлён: {new Date(compileState.updatedAt).toLocaleString("ru-RU")}
          </div>
        ) : null}
        <div className={styles.previewViewport}>
          {previewUrl ? (
            <PdfCanvasPreview
              className={styles.previewFrame}
              url={previewUrl}
              refreshKey={refreshKey}
              getFreshUrl={getFreshUrl}
              scrollFeel="inertial-heavy"
              freezeWidth
            />
          ) : (
            <div className={styles.previewStub}>Предпросмотр PDF появится здесь после сборки.</div>
          )}
        </div>
      </div>
    </div>
  );
}
