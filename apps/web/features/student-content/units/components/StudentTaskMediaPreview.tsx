import dynamic from "next/dynamic";
import Button from "@/components/ui/Button";
import styles from "../student-unit-detail.module.css";
import { PDF_ZOOM_DEFAULT } from "../hooks/use-student-unit-pdf-preview";

const PdfCanvasPreview = dynamic(() => import("@/components/PdfCanvasPreview"), {
  ssr: false,
  loading: () => <div className={styles.stub}>Загрузка PDF...</div>,
});

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
  solutionUrl: string | null;
  solutionRefreshKey?: string;
  getFreshSolutionUrl: () => Promise<string | null>;
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
  solutionUrl,
  solutionRefreshKey,
  getFreshSolutionUrl,
  onGoToStudentGraph,
}: Props) {
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
            <img
              src={statementImageUrl}
              alt="Иллюстрация к условию задачи"
              className={styles.statementImage}
              onError={onStatementImageLoadError}
            />
          ) : (
            <div className={styles.statementImageHint}>Изображение условия недоступно.</div>
          )}
        </div>
      ) : null}

      {showSolutionPanel ? (
        solutionLoading ? (
          <div className={styles.solutionHint}>Загружаем PDF-решение…</div>
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
        ) : solutionUrl ? (
          <div className={styles.solutionPdfViewport}>
            <PdfCanvasPreview
              className={styles.solutionPdfFrame}
              url={solutionUrl}
              refreshKey={solutionRefreshKey}
              getFreshUrl={getFreshSolutionUrl}
              zoom={PDF_ZOOM_DEFAULT}
              scrollFeel="inertial-heavy"
              freezeWidth
            />
          </div>
        ) : null
      ) : null}
    </>
  );
}
