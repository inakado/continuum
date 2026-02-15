"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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

const isRenderCancelledError = (error: unknown): boolean => {
  if (!error || typeof error !== "object") return false;
  const maybeError = error as { name?: string; message?: string };
  return (
    maybeError.name === "RenderingCancelledException" ||
    maybeError.name === "AbortException" ||
    (typeof maybeError.message === "string" &&
      maybeError.message.toLowerCase().includes("cancel"))
  );
};

const isPresignedExpiredError = (error: unknown): boolean => {
  if (!error || typeof error !== "object") return false;
  const maybeError = error as { message?: string; status?: number; name?: string };
  if (typeof maybeError.status === "number" && maybeError.status === 403) return true;
  const message = (maybeError.message ?? "").toLowerCase();
  if (!message) return false;
  return (
    message.includes("403") ||
    message.includes("forbidden") ||
    message.includes("expired") ||
    message.includes("signature") ||
    message.includes("accessdenied")
  );
};

const INERTIA_LERP = 0.14;
const INERTIA_DECAY = 0.9;
const INERTIA_INPUT_SCALE = 0.18;
const INERTIA_EDGE_DAMP = 0.4;
const INERTIA_STOP_EPSILON = 0.08;

export default function PdfCanvasPreview({
  url,
  className,
  withCredentials = true,
  zoom = 1,
  scrollFeel = "native",
  freezeWidth = false,
  refreshKey,
  getFreshUrl,
}: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRefs = useRef<Array<HTMLCanvasElement | null>>([]);
  const inertiaRafRef = useRef<number | null>(null);
  const inertiaVelocityRef = useRef(0);
  const inertiaTargetRef = useRef(0);
  const [observedWidth, setObservedWidth] = useState(0);
  const [containerWidth, setContainerWidth] = useState(0);
  const [pageCount, setPageCount] = useState(0);
  const [pdfDoc, setPdfDoc] = useState<any | null>(null);
  const [currentUrl, setCurrentUrl] = useState(url);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const refreshAttemptedKeyRef = useRef<string | null>(null);
  const activeRenderTasksRef = useRef<Array<any | null>>([]);
  const renderGenerationRef = useRef(0);

  useEffect(() => {
    setCurrentUrl(url);
  }, [url]);

  useEffect(() => {
    if (refreshKey) {
      refreshAttemptedKeyRef.current = null;
    }
  }, [refreshKey]);

  useEffect(() => {
    if (!refreshKey) {
      refreshAttemptedKeyRef.current = null;
    }
  }, [refreshKey, url]);

  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;

    const updateSize = () => {
      const width = node.clientWidth;
      setObservedWidth((prev) => {
        if (freezeWidth && prev > 0) return prev;
        return Math.abs(prev - width) >= 1 ? width : prev;
      });
    };

    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(node);
    return () => observer.disconnect();
  }, [freezeWidth]);

  useEffect(() => {
    if (observedWidth <= 0) return;
    if (containerWidth <= 0) {
      setContainerWidth(observedWidth);
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setContainerWidth((prev) => (Math.abs(prev - observedWidth) >= 1 ? observedWidth : prev));
    }, 140);
    return () => window.clearTimeout(timeoutId);
  }, [containerWidth, observedWidth]);

  useEffect(() => {
    const node = containerRef.current;
    if (!node || scrollFeel !== "inertial-heavy") return;
    if (typeof window === "undefined") return;

    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReduced) return;

    const stopInertia = () => {
      if (inertiaRafRef.current !== null) {
        window.cancelAnimationFrame(inertiaRafRef.current);
        inertiaRafRef.current = null;
      }
      inertiaVelocityRef.current = 0;
      inertiaTargetRef.current = 0;
    };

    const runInertia = () => {
      const currentTarget = inertiaTargetRef.current;
      const currentVelocity = inertiaVelocityRef.current;
      const nextVelocity = currentVelocity + (currentTarget - currentVelocity) * INERTIA_LERP;
      inertiaVelocityRef.current = nextVelocity;
      inertiaTargetRef.current = currentTarget * INERTIA_DECAY;

      const nextScroll = node.scrollTop + nextVelocity;
      const maxScroll = Math.max(0, node.scrollHeight - node.clientHeight);
      const clamped = Math.max(0, Math.min(maxScroll, nextScroll));
      node.scrollTop = clamped;

      const hitEdge = clamped <= 0 || clamped >= maxScroll;
      if (hitEdge) {
        inertiaVelocityRef.current *= INERTIA_EDGE_DAMP;
        inertiaTargetRef.current *= INERTIA_EDGE_DAMP;
      }

      const active =
        Math.abs(inertiaVelocityRef.current) > INERTIA_STOP_EPSILON ||
        Math.abs(inertiaTargetRef.current) > INERTIA_STOP_EPSILON;
      if (!active) {
        stopInertia();
        return;
      }

      inertiaRafRef.current = window.requestAnimationFrame(runInertia);
    };

    const normalizeWheel = (event: WheelEvent) => {
      const lineHeightPx = 16;
      const pageHeightPx = node.clientHeight;
      if (event.deltaMode === 1) return event.deltaY * lineHeightPx;
      if (event.deltaMode === 2) return event.deltaY * pageHeightPx;
      return event.deltaY;
    };

    const onWheel = (event: WheelEvent) => {
      if (event.ctrlKey) return;
      const deltaY = normalizeWheel(event);
      const maxScroll = Math.max(0, node.scrollHeight - node.clientHeight);
      if (maxScroll <= 0) {
        stopInertia();
        return;
      }

      const nextTop = deltaY < 0 && node.scrollTop <= 0.5;
      const nextBottom = deltaY > 0 && node.scrollTop >= maxScroll - 0.5;
      if (nextTop || nextBottom) {
        // Отдаем scroll родительской странице, чтобы не блокировать общий скролл.
        stopInertia();
        return;
      }

      event.preventDefault();
      inertiaTargetRef.current += deltaY * INERTIA_INPUT_SCALE;
      if (inertiaRafRef.current === null) {
        inertiaRafRef.current = window.requestAnimationFrame(runInertia);
      }
    };

    node.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      node.removeEventListener("wheel", onWheel);
      stopInertia();
    };
  }, [scrollFeel]);

  useEffect(() => {
    let disposed = false;
    let loadingTask: any | null = null;

    const loadPdf = async () => {
      setLoading(true);
      setRefreshing(false);
      setError(null);
      setPdfDoc(null);
      setPageCount(0);
      canvasRefs.current = [];

      try {
        const pdfjs = (await import("pdfjs-dist")) as any;
        if (typeof window !== "undefined" && !pdfjs.GlobalWorkerOptions.workerSrc) {
          pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;
        }
        loadingTask = pdfjs.getDocument({
          url: currentUrl,
          withCredentials,
        } as any);
        const doc = await loadingTask.promise;
        if (disposed) return;
        setPdfDoc(doc);
        setPageCount(doc.numPages);
      } catch (err) {
        if (disposed) return;
        const retryToken = refreshKey || currentUrl;
        const canRetry =
          Boolean(getFreshUrl) &&
          isPresignedExpiredError(err) &&
          Boolean(retryToken) &&
          refreshAttemptedKeyRef.current !== retryToken;

        if (canRetry && getFreshUrl && retryToken) {
          refreshAttemptedKeyRef.current = retryToken;
          setRefreshing(true);
          try {
            const freshUrl = await getFreshUrl();
            if (!disposed && freshUrl && freshUrl !== currentUrl) {
              setCurrentUrl(freshUrl);
              return;
            }
          } catch (refreshError) {
            if (!disposed) {
              const message =
                refreshError instanceof Error
                  ? refreshError.message
                  : "Не удалось обновить ссылку на PDF";
              setError(message);
            }
            return;
          } finally {
            if (!disposed) setRefreshing(false);
          }
        }

        const message = err instanceof Error ? err.message : "Не удалось загрузить PDF";
        setError(message);
      } finally {
        if (!disposed) setLoading(false);
      }
    };

    loadPdf();
    return () => {
      disposed = true;
      if (loadingTask && typeof loadingTask.destroy === "function") {
        loadingTask.destroy();
      }
      if (loadingTask && typeof loadingTask.cancel === "function") {
        loadingTask.cancel();
      }
    };
  }, [currentUrl, withCredentials, getFreshUrl, refreshKey]);

  useEffect(() => {
    if (!pdfDoc || pageCount <= 0 || containerWidth <= 0) return;
    let cancelled = false;
    const generation = renderGenerationRef.current + 1;
    renderGenerationRef.current = generation;

    for (const task of activeRenderTasksRef.current) {
      if (task && typeof task.cancel === "function") task.cancel();
    }
    activeRenderTasksRef.current = Array.from({ length: pageCount }, () => null);

    const renderPages = async () => {
      const dpr = window.devicePixelRatio || 1;
      for (let index = 0; index < pageCount; index += 1) {
        if (cancelled || renderGenerationRef.current !== generation) return;
        const canvas = canvasRefs.current[index];
        if (!canvas) continue;

        const page = await pdfDoc.getPage(index + 1);
        if (cancelled || renderGenerationRef.current !== generation) return;

        const baseViewport = page.getViewport({ scale: 1 });
        const fitScale = Math.max(containerWidth / baseViewport.width, 0.1);
        const scale = Math.max(fitScale * zoom, 0.1);
        const viewport = page.getViewport({ scale });

        canvas.style.width = `${viewport.width}px`;
        canvas.style.height = `${viewport.height}px`;
        canvas.width = Math.floor(viewport.width * dpr);
        canvas.height = Math.floor(viewport.height * dpr);

        const context = canvas.getContext("2d");
        if (!context) continue;
        context.setTransform(dpr, 0, 0, dpr, 0, 0);
        context.clearRect(0, 0, viewport.width, viewport.height);

        const previousTask = activeRenderTasksRef.current[index];
        if (previousTask && typeof previousTask.cancel === "function") {
          previousTask.cancel();
        }

        const renderTask = page.render({
          canvasContext: context,
          viewport,
        });
        activeRenderTasksRef.current[index] = renderTask;
        try {
          await renderTask.promise;
        } catch (err) {
          if (!isRenderCancelledError(err)) {
            throw err;
          }
        } finally {
          if (activeRenderTasksRef.current[index] === renderTask) {
            activeRenderTasksRef.current[index] = null;
          }
        }
      }
    };

    renderPages().catch((err) => {
      if (cancelled) return;
      const message = err instanceof Error ? err.message : "Не удалось отрисовать PDF";
      setError(message);
    });

    return () => {
      cancelled = true;
      if (renderGenerationRef.current === generation) {
        renderGenerationRef.current += 1;
      }
      for (const task of activeRenderTasksRef.current) {
        if (task && typeof task.cancel === "function") task.cancel();
      }
      activeRenderTasksRef.current = [];
    };
  }, [containerWidth, pageCount, pdfDoc, zoom]);

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
