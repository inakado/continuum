"use client";

import { Excalidraw } from "@excalidraw/excalidraw";
import type { ComponentProps } from "react";
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

  return (
    <div className={styles.boardCanvasShell} style={{ backgroundColor: viewBackgroundColor }}>
      <Excalidraw
        excalidrawAPI={handleReady}
        onChange={onChange}
        theme={theme}
        UIOptions={uiOptions}
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
