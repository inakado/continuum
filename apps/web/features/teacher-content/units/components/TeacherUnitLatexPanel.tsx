"use client";

import dynamic from "next/dynamic";
import {
  type CSSProperties,
  type ComponentProps,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Button from "@/components/ui/Button";
import Tabs from "@/components/ui/Tabs";
import type PdfCanvasPreviewComponent from "@/components/PdfCanvasPreview";
import type { TeacherUnitRenderedContentResponse } from "@/lib/api/teacher";
import type { CompileState } from "../hooks/use-teacher-unit-latex-compile";
import { typesetMathInElement } from "../../../student-content/units/mathjax-helper";
import styles from "../teacher-unit-detail.module.css";
type PdfCanvasPreviewProps = ComponentProps<typeof PdfCanvasPreviewComponent>;

const TeacherLatexEditor = dynamic(() => import("./TeacherLatexEditor").then((module) => module.TeacherLatexEditor), {
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
  renderedContent: TeacherUnitRenderedContentResponse | null;
  renderedContentLoading: boolean;
  renderedContentError: string | null;
  refreshRenderedContent: () => Promise<TeacherUnitRenderedContentResponse | null>;
};

type PreviewMode = "pdf" | "html";

export function TeacherUnitLatexPanel({
  title,
  value,
  onChange,
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
  renderedContent,
  renderedContentLoading,
  renderedContentError,
  refreshRenderedContent,
}: Props) {
  const [previewMode, setPreviewMode] = useState<PreviewMode>("pdf");
  const htmlContentRef = useRef<HTMLDivElement | null>(null);
  const typesetTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const resizeRafRef = useRef<number | null>(null);
  const previewTabs = useMemo(
    () => [
      { key: "pdf" as const, label: "PDF" },
      { key: "html" as const, label: "HTML" },
    ],
    [],
  );

  useEffect(() => {
    if (previewMode !== "html") return;
    void refreshRenderedContent().catch(() => {
      // HTML preview остаётся в последнем успешно загруженном состоянии.
    });
  }, [previewMode, refreshRenderedContent, renderedContent?.htmlKey, renderedContent?.pdfKey]);

  useEffect(() => {
    if (previewMode !== "html" || !renderedContent?.html || !htmlContentRef.current) return;
    const runTypeset = () => {
      if (!htmlContentRef.current) return;
      void typesetMathInElement(htmlContentRef.current).catch(() => {
        // Teacher preview остаётся читаемым и без typesetting.
      });
    };
    runTypeset();
    return () => {
      if (typesetTimeoutRef.current) {
        clearTimeout(typesetTimeoutRef.current);
        typesetTimeoutRef.current = null;
      }
      if (resizeRafRef.current !== null) {
        cancelAnimationFrame(resizeRafRef.current);
        resizeRafRef.current = null;
      }
    };
  }, [previewMode, renderedContent?.html]);

  useEffect(() => {
    if (previewMode !== "html" || !renderedContent?.html || !htmlContentRef.current) return;
    if (isResizingLayout) return;

    if (typesetTimeoutRef.current) {
      clearTimeout(typesetTimeoutRef.current);
    }
    typesetTimeoutRef.current = setTimeout(() => {
      resizeRafRef.current = requestAnimationFrame(() => {
        if (!htmlContentRef.current) return;
        void typesetMathInElement(htmlContentRef.current).catch(() => {
          // Teacher preview остаётся читаемым и без typesetting после resize.
        });
      });
    }, 120);

    return () => {
      if (typesetTimeoutRef.current) {
        clearTimeout(typesetTimeoutRef.current);
        typesetTimeoutRef.current = null;
      }
      if (resizeRafRef.current !== null) {
        cancelAnimationFrame(resizeRafRef.current);
        resizeRafRef.current = null;
      }
    };
  }, [previewMode, renderedContent?.html, previewWidthPercent, isResizingLayout]);

  return (
    <div
      ref={editorGridRef}
      className={`${styles.editorGrid} ${isResizingLayout ? styles.editorGridResizing : ""}`}
      style={editorGridStyle}
    >
      <div className={styles.editorPanel}>
        <div className={styles.kicker}>{title}</div>
        <TeacherLatexEditor value={value} onChange={onChange} />
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
          <Button variant="secondary" onClick={onCompile} disabled={compileState.loading}>
            {compileState.loading ? "Компиляция…" : "Скомпилировать HTML + PDF"}
          </Button>
          <div className={styles.previewModeTabsWrap}>
            <Tabs
              tabs={previewTabs}
              active={previewMode}
              onChange={setPreviewMode}
              ariaLabel={`Режим предпросмотра для раздела ${title}`}
              className={styles.previewModeTabs}
            />
          </div>
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
            HTML + PDF обновлены: {new Date(compileState.updatedAt).toLocaleString("ru-RU")}
          </div>
        ) : null}
        <div className={styles.previewViewport}>
          {previewMode === "pdf" ? (
            previewUrl ? (
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
            )
          ) : (
            <div className={styles.previewHtmlFrame}>
              {renderedContentError ? (
                <div className={styles.compileError} role="status" aria-live="polite">
                  <span>{renderedContentError}</span>
                </div>
              ) : null}
              {renderedContent?.html ? (
                <div
                  ref={htmlContentRef}
                  className={styles.previewHtmlContent}
                  dangerouslySetInnerHTML={{ __html: renderedContent.html }}
                />
              ) : (
                <div className={styles.previewStub}>
                  {renderedContentLoading
                    ? "Загрузка HTML…"
                    : "Предпросмотр HTML появится здесь после успешной сборки."}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
