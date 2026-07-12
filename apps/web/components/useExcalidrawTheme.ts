"use client";

import { CaptureUpdateAction } from "@excalidraw/excalidraw";
import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Theme } from "@/lib/theme";

export const EXCALIDRAW_CANVAS_BACKGROUND = {
  light: "#f8fafc",
  dark: "#1e293b",
} as const;

export const useExcalidrawTheme = (
  onReady?: (api: ExcalidrawImperativeAPI) => void,
) => {
  const [theme, setTheme] = useState<Theme>("light");
  const apiRef = useRef<ExcalidrawImperativeAPI | null>(null);
  const syncFrameRef = useRef<number | null>(null);
  const viewBackgroundColor = EXCALIDRAW_CANVAS_BACKGROUND[theme];

  useEffect(() => {
    const root = document.documentElement;
    const syncFromDocument = () => {
      setTheme(root.dataset.theme === "dark" ? "dark" : "light");
    };
    const observer = new MutationObserver(syncFromDocument);

    syncFromDocument();
    observer.observe(root, { attributes: true, attributeFilter: ["data-theme"] });
    return () => observer.disconnect();
  }, []);

  const syncTheme = useCallback(
    (api: ExcalidrawImperativeAPI) => {
      api.updateScene({
        appState: { theme, viewBackgroundColor },
        captureUpdate: CaptureUpdateAction.NEVER,
      });
    },
    [theme, viewBackgroundColor],
  );

  const scheduleThemeSync = useCallback(
    (api: ExcalidrawImperativeAPI) => {
      if (syncFrameRef.current !== null) {
        window.cancelAnimationFrame(syncFrameRef.current);
      }
      syncFrameRef.current = window.requestAnimationFrame(() => {
        syncFrameRef.current = null;
        if (apiRef.current === api) syncTheme(api);
      });
    },
    [syncTheme],
  );

  useEffect(() => {
    if (apiRef.current) scheduleThemeSync(apiRef.current);
    return () => {
      if (syncFrameRef.current !== null) {
        window.cancelAnimationFrame(syncFrameRef.current);
        syncFrameRef.current = null;
      }
    };
  }, [scheduleThemeSync]);

  const handleReady = useCallback(
    (api: ExcalidrawImperativeAPI) => {
      apiRef.current = api;
      onReady?.(api);
      scheduleThemeSync(api);
    },
    [onReady, scheduleThemeSync],
  );

  return { theme, viewBackgroundColor, handleReady };
};
