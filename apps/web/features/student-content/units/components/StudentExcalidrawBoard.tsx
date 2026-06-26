"use client";

import { Excalidraw } from "@excalidraw/excalidraw";
import type { ComponentProps } from "react";
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
  return (
    <div className={styles.boardCanvasShell}>
      <Excalidraw
        excalidrawAPI={onReady}
        onChange={onChange}
        UIOptions={uiOptions}
        initialData={{
          appState: {
            viewBackgroundColor: "#ffffff",
          },
        }}
      />
    </div>
  );
}
