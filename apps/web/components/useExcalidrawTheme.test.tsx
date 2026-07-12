import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";
import { EXCALIDRAW_CANVAS_BACKGROUND, useExcalidrawTheme } from "./useExcalidrawTheme";

vi.mock("@excalidraw/excalidraw", () => ({
  CaptureUpdateAction: { NEVER: "never" },
}));

describe("useExcalidrawTheme", () => {
  beforeEach(() => {
    document.documentElement.dataset.theme = "light";
  });

  it("synchronizes the Excalidraw UI and canvas without adding undo history", async () => {
    const api = { updateScene: vi.fn() } as unknown as ExcalidrawImperativeAPI;
    const onReady = vi.fn();
    const { result, rerender } = renderHook(() => useExcalidrawTheme(onReady));

    result.current.handleReady(api);
    await waitFor(() => {
      expect(api.updateScene).toHaveBeenLastCalledWith({
        appState: {
          theme: "light",
          viewBackgroundColor: EXCALIDRAW_CANVAS_BACKGROUND.light,
        },
        captureUpdate: "never",
      });
    });
    expect(onReady).toHaveBeenCalledWith(api);

    act(() => {
      document.documentElement.dataset.theme = "dark";
    });
    rerender();
    await waitFor(() => {
      expect(api.updateScene).toHaveBeenLastCalledWith({
        appState: {
          theme: "dark",
          viewBackgroundColor: EXCALIDRAW_CANVAS_BACKGROUND.dark,
        },
        captureUpdate: "never",
      });
    });
  });
});
