"use client";

import { useMemo, useRef } from "react";
import {
  useInertialScrollViewport,
  usePdfCanvasRenderer,
  usePdfDocumentLoader,
  usePdfViewportWidth,
} from "./pdf-preview-hooks";
import styles from "./pdf-canvas-preview.module.css";

type Props = {
  url: string;
  className?: string;
  withCredentials?: boolean;
  zoom?: number;
  scrollFeel?: "native" | "inertial-heavy";
  freezeWidth?: boolean;
  refreshKey?: string;
  getFreshUrl?: () => Promise<string | null>;
};

export default function PdfCanvasPreview({
  url,
  refreshKey,
  ...props
}: Props) {
  return <PdfCanvasPreviewContent key={`${refreshKey ?? "url"}:${url}`} url={url} refreshKey={refreshKey} {...props} />;
}

function PdfCanvasPreviewContent({
  url,
  className,
  withCredentials = false,
  zoom = 1,
  scrollFeel = "native",
  freezeWidth = false,
  refreshKey,
  getFreshUrl,
}: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRefs = useRef<Array<HTMLCanvasElement | null>>([]);
  const containerWidth = usePdfViewportWidth({ containerRef, freezeWidth });
  const { error: loadError, loading, pageCount, pdfDoc, refreshing } = usePdfDocumentLoader({
    url,
    withCredentials,
    refreshKey,
    getFreshUrl,
  });
  const renderError = usePdfCanvasRenderer({
    canvasRefs,
    containerWidth,
    pageCount,
    pdfDoc,
    zoom,
  });
  useInertialScrollViewport({ containerRef, scrollFeel });
  const error = loadError ?? renderError;

  const rootClassName = useMemo(
    () => [styles.root, className].filter(Boolean).join(" "),
    [className],
  );

  return (
    <div ref={containerRef} className={rootClassName}>
      {loading ? <div className={styles.state}>{refreshing ? "Обновляем ссылку…" : "Загрузка PDF…"}</div> : null}
      {error ? <div className={styles.state}>{error}</div> : null}
      {!loading && !error ? (
        <div className={styles.pages}>
          {Array.from({ length: pageCount }).map((_, index) => (
            <canvas
              key={index}
              ref={(node) => {
                canvasRefs.current[index] = node;
              }}
              className={styles.canvas}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
