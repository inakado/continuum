"use client";

import { Excalidraw } from "@excalidraw/excalidraw";
import { Maximize2, Minimize2 } from "lucide-react";
import { useEffect, useRef, useState, type ComponentProps } from "react";
import { useExcalidrawTheme } from "@/components/useExcalidrawTheme";
import styles from "../student-unit-detail.module.css";

type ExcalidrawChangeHandler = NonNullable<ComponentProps<typeof Excalidraw>["onChange"]>;
type ExcalidrawApiHandler = NonNullable<ComponentProps<typeof Excalidraw>["excalidrawAPI"]>;

type Props = {
  onReady: ExcalidrawApiHandler;
  onChange: ExcalidrawChangeHandler;
};

const uiOptions: ComponentProps<typeof Excalidraw>["UIOptions"] = {
  canvasActions: {
    export: false,
    loadScene: false,
    saveAsImage: false,
    saveToActiveFile: false,
    toggleTheme: null,
  },
  tools: {
    image: false,
  },
};

export function StudentExcalidrawBoard({ onReady, onChange }: Props) {
  const { theme, viewBackgroundColor, handleReady } = useExcalidrawTheme(onReady);
  const shellRef = useRef<HTMLDivElement>(null);
  const [isNativeFullscreen, setIsNativeFullscreen] = useState(false);
  const [isFallbackFocusMode, setIsFallbackFocusMode] = useState(false);
  const isFocusMode = isNativeFullscreen || isFallbackFocusMode;

  useEffect(() => {
    const syncFullscreenState = () => {
      setIsNativeFullscreen(document.fullscreenElement === shellRef.current);
    };
    document.addEventListener("fullscreenchange", syncFullscreenState);
    return () => document.removeEventListener("fullscreenchange", syncFullscreenState);
  }, []);

  useEffect(() => {
    if (!isFallbackFocusMode) return;
    const previousOverflow = document.body.style.overflow;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsFallbackFocusMode(false);
    };

    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isFallbackFocusMode]);

  const toggleFocusMode = async () => {
    const shell = shellRef.current;
    if (!shell) return;

    if (document.fullscreenElement === shell) {
      await document.exitFullscreen();
      return;
    }
    if (isFallbackFocusMode) {
      setIsFallbackFocusMode(false);
      return;
    }

    try {
      if (!shell.requestFullscreen) throw new Error("Fullscreen API is unavailable");
      await shell.requestFullscreen();
    } catch {
      setIsFallbackFocusMode(true);
    }
  };

  const focusModeLabel = isFocusMode ? "Выйти из полноэкранного режима" : "Развернуть доску на весь экран";

  return (
    <div
      ref={shellRef}
      className={`${styles.boardCanvasShell} ${isFocusMode ? styles.boardCanvasShellFocusMode : ""}`}
      style={{ backgroundColor: viewBackgroundColor }}
      data-focus-mode={isFocusMode}
    >
      <Excalidraw
        excalidrawAPI={handleReady}
        onChange={onChange}
        theme={theme}
        UIOptions={uiOptions}
        renderTopRightUI={() => (
          <button
            type="button"
            className={styles.boardFullscreenButton}
            onClick={() => void toggleFocusMode()}
            aria-label={focusModeLabel}
            aria-pressed={isFocusMode}
            title={focusModeLabel}
          >
            {isFocusMode ? <Minimize2 size={18} aria-hidden="true" /> : <Maximize2 size={18} aria-hidden="true" />}
          </button>
        )}
        initialData={{
          appState: {
            theme,
            viewBackgroundColor,
          },
        }}
      />
    </div>
  );
}
