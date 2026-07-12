import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { loadStudentExcalidrawBoard } from "../components/student-excalidraw-board-loader";
import { useStudentBoardPrefetch } from "./use-student-board-prefetch";

vi.mock("../components/student-excalidraw-board-loader", () => ({
  loadStudentExcalidrawBoard: vi.fn(() => Promise.resolve(() => null)),
}));

const setConnection = (connection?: { effectiveType?: string; saveData?: boolean }) => {
  Object.defineProperty(navigator, "connection", {
    configurable: true,
    value: connection,
  });
};

describe("useStudentBoardPrefetch", () => {
  const cancelIdleCallback = vi.fn();
  let idleCallback: (() => void) | null = null;

  beforeEach(() => {
    idleCallback = null;
    vi.mocked(loadStudentExcalidrawBoard).mockClear();
    cancelIdleCallback.mockClear();
    setConnection();
    window.requestIdleCallback = vi.fn((callback) => {
      idleCallback = callback;
      return 7;
    });
    window.cancelIdleCallback = cancelIdleCallback;
  });

  afterEach(() => {
    setConnection();
  });

  it("loads the board when the browser becomes idle", () => {
    renderHook(() => useStudentBoardPrefetch(true));

    expect(loadStudentExcalidrawBoard).not.toHaveBeenCalled();
    act(() => idleCallback?.());
    expect(loadStudentExcalidrawBoard).toHaveBeenCalledTimes(1);
  });

  it.each([
    { effectiveType: "2g" },
    { effectiveType: "slow-2g" },
    { saveData: true },
  ])("skips prefetch for constrained connections: %o", (connection) => {
    setConnection(connection);

    renderHook(() => useStudentBoardPrefetch(true));

    expect(window.requestIdleCallback).not.toHaveBeenCalled();
    expect(loadStudentExcalidrawBoard).not.toHaveBeenCalled();
  });

  it("does not schedule prefetch for units without board tasks", () => {
    renderHook(() => useStudentBoardPrefetch(false));

    expect(window.requestIdleCallback).not.toHaveBeenCalled();
  });

  it("cancels pending idle work on unmount", () => {
    const { unmount } = renderHook(() => useStudentBoardPrefetch(true));

    unmount();

    expect(cancelIdleCallback).toHaveBeenCalledWith(7);
  });
});
