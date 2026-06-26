"use client";

import { Excalidraw } from "@excalidraw/excalidraw";
import type { ComponentProps } from "react";
import type { ExcalidrawInitialDataState } from "@excalidraw/excalidraw/types";
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
  return (
    <div className={styles.feedbackBoardCanvasShell}>
      <Excalidraw
        initialData={initialData}
        UIOptions={uiOptions}
        viewModeEnabled
      />
    </div>
  );
}
