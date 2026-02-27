import { useEffect, useMemo, useState } from "react";
import type { Task } from "@/lib/api/student";

export const useStudentTaskNavigation = (orderedTasks: Task[]) => {
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);

  useEffect(() => {
    if (!orderedTasks.length) {
      setActiveTaskId(null);
      return;
    }

    setActiveTaskId((prev) => {
      const fallbackId = orderedTasks[0].id;
      if (!prev) return fallbackId;
      const index = orderedTasks.findIndex((task) => task.id === prev);
      if (index === -1) return fallbackId;
      return prev;
    });
  }, [orderedTasks]);

  const activeTaskIndex = useMemo(() => {
    if (!orderedTasks.length) return 0;
    if (!activeTaskId) return 0;
    const index = orderedTasks.findIndex((task) => task.id === activeTaskId);
    return index >= 0 ? index : 0;
  }, [activeTaskId, orderedTasks]);

  const activeTask = useMemo(() => orderedTasks[activeTaskIndex] ?? null, [activeTaskIndex, orderedTasks]);

  return {
    activeTaskId,
    setActiveTaskId,
    activeTaskIndex,
    activeTask,
  };
};
