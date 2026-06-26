"use client";

import { Excalidraw } from "@excalidraw/excalidraw";
import type { ComponentProps } from "react";
import type { ExcalidrawInitialDataState, ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";
import type { ExcalidrawElement } from "@excalidraw/excalidraw/element/types";
import styles from "../teacher-review-submission-detail-panel.module.css";

type ExcalidrawChangeHandler = NonNullable<ComponentProps<typeof Excalidraw>["onChange"]>;

type Props = {
  initialData: ExcalidrawInitialDataState;
  onChange: (elements: readonly ExcalidrawElement[]) => void;
  onReady: (api: ExcalidrawImperativeAPI) => void;
  onUserInteraction: () => void;
  viewModeEnabled: boolean;
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

export function TeacherExcalidrawReviewBoard({
  initialData,
  onChange,
  onReady,
  onUserInteraction,
  viewModeEnabled,
}: Props) {
  const handleChange: ExcalidrawChangeHandler = (elements) => {
    onChange(elements);
  };

  return (
    <div
      className={styles.boardReviewCanvasShell}
      onKeyDownCapture={onUserInteraction}
      onPointerDownCapture={onUserInteraction}
    >
      <Excalidraw
        excalidrawAPI={onReady}
        initialData={initialData}
        onChange={handleChange}
        UIOptions={uiOptions}
        viewModeEnabled={viewModeEnabled}
      />
    </div>
  );
}
