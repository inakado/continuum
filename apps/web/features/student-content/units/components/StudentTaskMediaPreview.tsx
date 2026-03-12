import { useEffect, useRef } from "react";
import Image from "next/image";
import Button from "@/components/ui/Button";
import styles from "../student-unit-detail.module.css";
import { typesetMathInElement } from "../mathjax-helper";

type Props = {
  hasStatementImage: boolean;
  statementImageLoading: boolean;
  statementImageError: string | null;
  statementImageUrl: string | null;
  onStatementImageLoadError: () => void;
  showSolutionPanel: boolean;
  solutionLoading: boolean;
  solutionError: string | null;
  solutionErrorCode: string | null;
  solutionHtml: string | null;
  solutionRefreshKey?: string;
  onGoToStudentGraph: () => void;
};

export function StudentTaskMediaPreview({
  hasStatementImage,
  statementImageLoading,
  statementImageError,
  statementImageUrl,
  onStatementImageLoadError,
  showSolutionPanel,
  solutionLoading,
  solutionError,
  solutionErrorCode,
  solutionHtml,
  solutionRefreshKey,
  onGoToStudentGraph,
}: Props) {
  const solutionHtmlRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!solutionHtml || !solutionHtmlRef.current) return;
    void typesetMathInElement(solutionHtmlRef.current).catch(() => {
      // HTML решения остаётся читаемым и без typesetting.
    });
  }, [solutionHtml, solutionRefreshKey]);

  return (
    <>
      {hasStatementImage ? (
        <div className={styles.statementImageBlock}>
          {statementImageLoading ? (
            <div className={styles.statementImageHint}>Загрузка изображения…</div>
          ) : statementImageError ? (
            <div className={styles.statementImageError} role="status" aria-live="polite">
              {statementImageError}
            </div>
          ) : statementImageUrl ? (
            <Image
              src={statementImageUrl}
              alt="Иллюстрация к условию задачи"
              className={styles.statementImage}
              width={1120}
              height={840}
              unoptimized
              onError={onStatementImageLoadError}
            />
          ) : (
            <div className={styles.statementImageHint}>Изображение условия недоступно.</div>
          )}
        </div>
      ) : null}

      {showSolutionPanel ? (
        solutionLoading ? (
          <div className={styles.solutionHint}>Загружаем HTML-решение…</div>
        ) : solutionError ? (
          <div className={styles.solutionError} role="status" aria-live="polite">
            {solutionError}
            {solutionErrorCode === "UNIT_LOCKED" ? (
              <div className={styles.solutionErrorActions}>
                <Button variant="ghost" onClick={onGoToStudentGraph}>
                  К графу раздела
                </Button>
              </div>
            ) : null}
          </div>
        ) : solutionHtml ? (
          <div className={styles.solutionHtmlViewport}>
            <div
              ref={solutionHtmlRef}
              className={`${styles.htmlContent} ${styles.solutionHtmlContent}`}
              dangerouslySetInnerHTML={{ __html: solutionHtml }}
            />
          </div>
        ) : (
          <div className={styles.solutionStub}>HTML-решение пока не подготовлено преподавателем.</div>
        )
      ) : null}
    </>
  );
}
