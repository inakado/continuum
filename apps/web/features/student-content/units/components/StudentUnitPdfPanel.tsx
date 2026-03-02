import dynamic from "next/dynamic";
import styles from "../student-unit-detail.module.css";
import {
  PDF_ZOOM_MAX,
  PDF_ZOOM_MIN,
  PDF_ZOOM_STEP,
} from "../hooks/use-student-unit-pdf-preview";

const PdfCanvasPreview = dynamic(() => import("@/components/PdfCanvasPreview"), {
  ssr: false,
  loading: () => <div className={styles.stub}>Загрузка PDF...</div>,
});

type Props = {
  previewError: string | null;
  previewUrl: string | null;
  previewLoading: boolean;
  unavailableText: string;
  refreshKey?: string;
  getFreshUrl: () => Promise<string | null>;
  zoom: number;
  onZoomChange: (zoom: number) => void;
};

export function StudentUnitPdfPanel({
  previewError,
  previewUrl,
  previewLoading,
  unavailableText,
  refreshKey,
  getFreshUrl,
  zoom,
  onZoomChange,
}: Props) {
  return (
    <div className={styles.pdfPanel}>
      {previewError ? (
        <div className={styles.previewError} role="status" aria-live="polite">
          {previewError}
        </div>
      ) : null}

      <div className={styles.pdfToolbar}>
        <span className={styles.pdfToolbarLabel}>Масштаб</span>
        <span className={styles.pdfZoomGroup}>
          <button
            type="button"
            className={styles.pdfZoomButton}
            onClick={() => onZoomChange(zoom - PDF_ZOOM_STEP)}
            disabled={zoom <= PDF_ZOOM_MIN}
          >
            −
          </button>
          <span className={styles.pdfZoomValue}>{Math.round(zoom * 100)}%</span>
          <button
            type="button"
            className={styles.pdfZoomButton}
            onClick={() => onZoomChange(zoom + PDF_ZOOM_STEP)}
            disabled={zoom >= PDF_ZOOM_MAX}
          >
            +
          </button>
        </span>
      </div>

      <div className={styles.pdfViewport}>
        {previewUrl ? (
          <PdfCanvasPreview
            className={styles.pdfFrame}
            url={previewUrl}
            refreshKey={refreshKey}
            getFreshUrl={getFreshUrl}
            zoom={zoom}
            scrollFeel="inertial-heavy"
            freezeWidth
          />
        ) : (
          <div className={styles.stub}>{previewLoading ? "Загрузка PDF..." : unavailableText}</div>
        )}
      </div>
    </div>
  );
}
