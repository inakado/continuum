import { useEffect, useReducer, useRef, useState, type MutableRefObject, type RefObject } from "react";
import type {
  DocumentInitParameters,
  PDFDocumentLoadingTask,
  PDFDocumentProxy,
  RenderTask,
} from "pdfjs-dist/types/src/display/api";
import type * as PdfJsModule from "pdfjs-dist";

export type PdfPreviewScrollFeel = "native" | "inertial-heavy";

const INERTIA_LERP = 0.14;
const INERTIA_DECAY = 0.9;
const INERTIA_INPUT_SCALE = 0.18;
const INERTIA_EDGE_DAMP = 0.4;
const INERTIA_STOP_EPSILON = 0.08;

type LoadState = {
  error: string | null;
  loading: boolean;
  pageCount: number;
  pdfDoc: PDFDocumentProxy | null;
  refreshedUrl: string | null;
  refreshing: boolean;
};

type LoadAction =
  | { type: "load/start" }
  | { type: "load/success"; doc: PDFDocumentProxy }
  | { type: "load/error"; message: string }
  | { type: "refresh/start" }
  | { type: "refresh/success"; url: string }
  | { type: "refresh/error"; message: string };

const initialLoadState: LoadState = {
  error: null,
  loading: false,
  pageCount: 0,
  pdfDoc: null,
  refreshedUrl: null,
  refreshing: false,
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

const ensurePdfWorkerSrc = (pdfjs: typeof PdfJsModule) => {
  if (typeof window === "undefined" || pdfjs.GlobalWorkerOptions.workerSrc) return;
  pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;
};

const createDocumentParams = (url: string, withCredentials: boolean): DocumentInitParameters => ({
  url,
  withCredentials,
});

const startPdfLoadingTask = async ({
  url,
  withCredentials,
}: {
  url: string;
  withCredentials: boolean;
}) => {
  const pdfjs = await import("pdfjs-dist");
  ensurePdfWorkerSrc(pdfjs);
  return pdfjs.getDocument(createDocumentParams(url, withCredentials));
};

const getRetryToken = (refreshKey: string | undefined, currentUrl: string) => refreshKey || currentUrl;

const canRetryWithFreshUrl = ({
  attemptedToken,
  error,
  getFreshUrl,
  retryToken,
}: {
  attemptedToken: string | null;
  error: unknown;
  getFreshUrl?: () => Promise<string | null>;
  retryToken: string | null;
}) =>
  Boolean(getFreshUrl) &&
  isPresignedExpiredError(error) &&
  Boolean(retryToken) &&
  attemptedToken !== retryToken;

const getLoadErrorMessage = (error: unknown, fallback: string) =>
  error instanceof Error ? error.message : fallback;

const loadReducer = (state: LoadState, action: LoadAction): LoadState => {
  switch (action.type) {
    case "load/start":
      return {
        ...state,
        error: null,
        loading: true,
        pageCount: 0,
        pdfDoc: null,
        refreshing: false,
      };
    case "load/success":
      return {
        ...state,
        error: null,
        loading: false,
        pageCount: action.doc.numPages,
        pdfDoc: action.doc,
      };
    case "load/error":
      return {
        ...state,
        error: action.message,
        loading: false,
        pageCount: 0,
        pdfDoc: null,
        refreshing: false,
      };
    case "refresh/start":
      return {
        ...state,
        refreshing: true,
      };
    case "refresh/success":
      return {
        ...state,
        refreshedUrl: action.url,
        refreshing: false,
      };
    case "refresh/error":
      return {
        ...state,
        error: action.message,
        loading: false,
        refreshing: false,
      };
    default:
      return state;
  }
};

export const usePdfViewportWidth = ({
  containerRef,
  freezeWidth,
}: {
  containerRef: RefObject<HTMLDivElement | null>;
  freezeWidth: boolean;
}) => {
  const [observedWidth, setObservedWidth] = useState(0);
  const [containerWidth, setContainerWidth] = useState(0);

  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;

    const updateSize = () => {
      const width = node.clientWidth;
      setObservedWidth((previous) => {
        if (freezeWidth && previous > 0) return previous;
        return Math.abs(previous - width) >= 1 ? width : previous;
      });
    };

    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(node);
    return () => observer.disconnect();
  }, [containerRef, freezeWidth]);

  useEffect(() => {
    if (observedWidth <= 0) return;
    if (containerWidth <= 0) {
      setContainerWidth(observedWidth);
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setContainerWidth((previous) =>
        Math.abs(previous - observedWidth) >= 1 ? observedWidth : previous,
      );
    }, 140);
    return () => window.clearTimeout(timeoutId);
  }, [containerWidth, observedWidth]);

  return containerWidth;
};

export const useInertialScrollViewport = ({
  containerRef,
  scrollFeel,
}: {
  containerRef: RefObject<HTMLDivElement | null>;
  scrollFeel: PdfPreviewScrollFeel;
}) => {
  const inertiaRafRef = useRef<number | null>(null);
  const inertiaVelocityRef = useRef(0);
  const inertiaTargetRef = useRef(0);

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
  }, [containerRef, scrollFeel]);
};

export const usePdfDocumentLoader = ({
  getFreshUrl,
  refreshKey,
  url,
  withCredentials,
}: {
  getFreshUrl?: () => Promise<string | null>;
  refreshKey?: string;
  url: string;
  withCredentials: boolean;
}) => {
  const [state, dispatch] = useReducer(loadReducer, initialLoadState);
  const refreshAttemptedKeyRef = useRef<string | null>(null);
  const currentUrl = state.refreshedUrl ?? url;

  useEffect(() => {
    let disposed = false;
    let loadingTask: PDFDocumentLoadingTask | null = null;

    const refreshExpiredUrl = async (retryToken: string) => {
      if (!getFreshUrl) return "miss";

      refreshAttemptedKeyRef.current = retryToken;
      dispatch({ type: "refresh/start" });
      try {
        const freshUrl = await getFreshUrl();
        if (!disposed && freshUrl && freshUrl !== currentUrl) {
          dispatch({ type: "refresh/success", url: freshUrl });
          return "updated";
        }
      } catch (refreshError) {
        if (!disposed) {
          dispatch({
            type: "refresh/error",
            message: getLoadErrorMessage(refreshError, "Не удалось обновить ссылку на PDF"),
          });
        }
        return "failed";
      }

      if (!disposed) {
        dispatch({
          type: "load/error",
          message: "Не удалось обновить ссылку на PDF",
        });
      }
      return "miss";
    };

    const loadPdf = async () => {
      dispatch({ type: "load/start" });

      try {
        loadingTask = await startPdfLoadingTask({ url: currentUrl, withCredentials });
        const doc = await loadingTask.promise;
        if (!disposed) {
          dispatch({ type: "load/success", doc });
        }
      } catch (error) {
        if (disposed) return;
        const retryToken = getRetryToken(refreshKey, currentUrl);
        if (
          canRetryWithFreshUrl({
            attemptedToken: refreshAttemptedKeyRef.current,
            error,
            getFreshUrl,
            retryToken,
          }) &&
          retryToken
        ) {
          const refreshResult = await refreshExpiredUrl(retryToken);
          if (refreshResult !== "miss") return;
        }

        dispatch({
          type: "load/error",
          message: getLoadErrorMessage(error, "Не удалось загрузить PDF"),
        });
      }
    };

    void loadPdf();
    return () => {
      disposed = true;
      if (loadingTask && typeof loadingTask.destroy === "function") {
        loadingTask.destroy();
      }
    };
  }, [currentUrl, getFreshUrl, refreshKey, withCredentials]);

  return {
    currentUrl,
    error: state.error,
    loading: state.loading,
    pageCount: state.pageCount,
    pdfDoc: state.pdfDoc,
    refreshing: state.refreshing,
  };
};

export const usePdfCanvasRenderer = ({
  canvasRefs,
  containerWidth,
  pageCount,
  pdfDoc,
  zoom,
}: {
  canvasRefs: MutableRefObject<Array<HTMLCanvasElement | null>>;
  containerWidth: number;
  pageCount: number;
  pdfDoc: PDFDocumentProxy | null;
  zoom: number;
}) => {
  const activeRenderTasksRef = useRef<Array<RenderTask | null>>([]);
  const renderGenerationRef = useRef(0);
  const [renderError, setRenderError] = useState<string | null>(null);

  useEffect(() => {
    if (!pdfDoc || pageCount <= 0 || containerWidth <= 0) return;
    let cancelled = false;
    const generation = renderGenerationRef.current + 1;
    renderGenerationRef.current = generation;
    setRenderError(null);

    for (const task of activeRenderTasksRef.current) {
      if (task && typeof task.cancel === "function") {
        task.cancel();
      }
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
          canvas,
          viewport,
        });
        activeRenderTasksRef.current[index] = renderTask;
        try {
          await renderTask.promise;
        } catch (error) {
          if (!isRenderCancelledError(error)) {
            throw error;
          }
        } finally {
          if (activeRenderTasksRef.current[index] === renderTask) {
            activeRenderTasksRef.current[index] = null;
          }
        }
      }
    };

    renderPages().catch((error) => {
      if (cancelled) return;
      setRenderError(error instanceof Error ? error.message : "Не удалось отрисовать PDF");
    });

    return () => {
      cancelled = true;
      if (renderGenerationRef.current === generation) {
        renderGenerationRef.current += 1;
      }
      for (const task of activeRenderTasksRef.current) {
        if (task && typeof task.cancel === "function") {
          task.cancel();
        }
      }
      activeRenderTasksRef.current = [];
    };
  }, [canvasRefs, containerWidth, pageCount, pdfDoc, zoom]);

  return renderError;
};
