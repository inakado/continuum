"use client";

import { useEffect, useRef } from "react";
import type { StudentUnitRenderedContentResponse } from "@/lib/api/student";
import styles from "../student-unit-detail.module.css";
import { typesetMathInElement } from "../mathjax-helper";

type Props = {
  content: StudentUnitRenderedContentResponse;
  previewError: string | null;
  previewLoading: boolean;
  unavailableText: string;
};

export function StudentUnitHtmlPanel({
  content,
  previewError,
  previewLoading,
  unavailableText,
}: Props) {
  const contentRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!content.html || !contentRef.current) return;

    void typesetMathInElement(contentRef.current).catch(() => {
      // HTML остаётся читаемым и без typesetting; не ломаем весь panel из-за runtime helper.
    });
  }, [content.html]);

  return (
    <div className={styles.htmlPanel}>
      {previewError ? (
        <div className={styles.previewError} role="status" aria-live="polite">
          {previewError}
        </div>
      ) : null}

      <div className={styles.htmlToolbar}>
        <span className={styles.pdfToolbarLabel}>Формат</span>
        <span className={styles.htmlToolbarValue}>Адаптивный HTML</span>
        {content.pdfUrl ? (
          <a
            className={styles.downloadLink}
            href={content.pdfUrl}
            target="_blank"
            rel="noreferrer"
            download
          >
            Скачать PDF
          </a>
        ) : null}
      </div>

      <div className={styles.htmlViewport}>
        {content.html ? (
          <div
            ref={contentRef}
            className={styles.htmlContent}
            dangerouslySetInnerHTML={{ __html: content.html }}
          />
        ) : (
          <div className={styles.stub}>{previewLoading ? "Загрузка HTML..." : unavailableText}</div>
        )}
      </div>
    </div>
  );
}
