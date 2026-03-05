"use client";

import { useEffect, useState, useRef } from "react";
import type { StudentUnitRenderedContentResponse } from "@/lib/api/student";
import styles from "../student-unit-detail.module.css";
import { typesetMathInElement } from "../mathjax-helper";

type Props = {
  content: StudentUnitRenderedContentResponse;
  getFreshPdfUrl: () => Promise<string | null>;
  previewError: string | null;
  previewLoading: boolean;
  unavailableText: string;
};

export function StudentUnitHtmlPanel({
  content,
  getFreshPdfUrl,
  previewError,
  previewLoading,
  unavailableText,
}: Props) {
  const contentRef = useRef<HTMLDivElement | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    if (!content.html || !contentRef.current) return;

    void typesetMathInElement(contentRef.current).catch(() => {
      // HTML остаётся читаемым и без typesetting; не ломаем весь panel из-за runtime helper.
    });
  }, [content.html]);

  const handleDownloadPdf = async () => {
    if (downloading) return;
    setDownloading(true);
    setDownloadError(null);

    try {
      const url = (await getFreshPdfUrl()) ?? content.pdfUrl;
      if (!url) {
        setDownloadError("PDF временно недоступен. Повторите попытку.");
        return;
      }

      const popup = window.open("about:blank", "_blank", "noopener,noreferrer");
      if (popup) {
        popup.location.href = url;
      } else {
        window.open(url, "_blank", "noopener,noreferrer");
      }
    } catch {
      setDownloadError("Не удалось получить ссылку для скачивания PDF.");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className={styles.htmlPanel}>
      {previewError ? (
        <div className={styles.previewError} role="status" aria-live="polite">
          {previewError}
        </div>
      ) : null}

      {content.pdfUrl ? (
        <div className={styles.htmlToolbar}>
          <button
            type="button"
            className={styles.downloadLink}
            onClick={handleDownloadPdf}
            disabled={downloading}
          >
            {downloading ? "Готовим PDF..." : "Скачать PDF"}
          </button>
        </div>
      ) : null}

      {downloadError ? (
        <div className={styles.previewError} role="status" aria-live="polite">
          {downloadError}
        </div>
      ) : null}

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
