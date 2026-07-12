"use client";

import { Excalidraw } from "@excalidraw/excalidraw";
import type { ComponentProps } from "react";
import type { ExcalidrawInitialDataState, ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";
import type { ExcalidrawElement } from "@excalidraw/excalidraw/element/types";
import { useExcalidrawTheme } from "@/components/useExcalidrawTheme";
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
  const { theme, viewBackgroundColor, handleReady } = useExcalidrawTheme(onReady);

  const handleChange: ExcalidrawChangeHandler = (elements) => {
    onChange(elements);
  };

  return (
    <div
      className={styles.boardReviewCanvasShell}
      style={{ backgroundColor: viewBackgroundColor }}
      onKeyDownCapture={onUserInteraction}
      onPointerDownCapture={onUserInteraction}
    >
      <Excalidraw
        excalidrawAPI={handleReady}
        initialData={{
          ...initialData,
          appState: { ...initialData.appState, theme, viewBackgroundColor },
        }}
        onChange={handleChange}
        UIOptions={uiOptions}
        theme={theme}
        viewModeEnabled={viewModeEnabled}
      />
    </div>
  );
}
