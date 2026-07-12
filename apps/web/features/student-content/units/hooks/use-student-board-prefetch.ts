import { useEffect } from "react";
import { loadStudentExcalidrawBoard } from "../components/student-excalidraw-board-loader";

type NavigatorWithConnection = Navigator & {
  connection?: {
    effectiveType?: string;
    saveData?: boolean;
  };
};

type WindowWithOptionalIdleCallback = Omit<Window, "requestIdleCallback" | "cancelIdleCallback"> & {
  requestIdleCallback?: Window["requestIdleCallback"];
  cancelIdleCallback?: Window["cancelIdleCallback"];
};

const SLOW_CONNECTIONS = new Set(["slow-2g", "2g"]);

export const useStudentBoardPrefetch = (enabled: boolean) => {
  useEffect(() => {
    const connection = (navigator as NavigatorWithConnection).connection;
    if (
      !enabled ||
      connection?.saveData ||
      (connection?.effectiveType && SLOW_CONNECTIONS.has(connection.effectiveType))
    ) {
      return;
    }

    const preload = () => void loadStudentExcalidrawBoard().catch(() => undefined);
    const idleWindow = window as unknown as WindowWithOptionalIdleCallback;
    if (idleWindow.requestIdleCallback && idleWindow.cancelIdleCallback) {
      const idleId = idleWindow.requestIdleCallback(preload, { timeout: 2_000 });
      return () => idleWindow.cancelIdleCallback?.(idleId);
    }

    const timeoutId = window.setTimeout(preload, 1_200);
    return () => window.clearTimeout(timeoutId);
  }, [enabled]);
};
