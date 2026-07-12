"use client";

import { Excalidraw } from "@excalidraw/excalidraw";
import type { ComponentProps } from "react";
import type { ExcalidrawInitialDataState } from "@excalidraw/excalidraw/types";
import { useExcalidrawTheme } from "@/components/useExcalidrawTheme";
import styles from "../student-unit-detail.module.css";

type Props = {
  initialData: ExcalidrawInitialDataState;
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

export function StudentFeedbackExcalidrawBoard({ initialData }: Props) {
  const { theme, viewBackgroundColor, handleReady } = useExcalidrawTheme();

  return (
    <div className={styles.feedbackBoardCanvasShell} style={{ backgroundColor: viewBackgroundColor }}>
      <Excalidraw
        excalidrawAPI={handleReady}
        initialData={{
          ...initialData,
          appState: { ...initialData.appState, theme, viewBackgroundColor },
        }}
        theme={theme}
        UIOptions={uiOptions}
        viewModeEnabled
      />
    </div>
  );
}
