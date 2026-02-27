import { useCallback, useEffect, useRef, useState } from "react";
import { teacherApi, type Task, type UnitVideo, type UnitWithTasks } from "@/lib/api/teacher";
import { getApiErrorMessage } from "../../shared/api-errors";

const AUTOSAVE_DEBOUNCE_MS = 1000;

export type SaveState =
  | { state: "idle" }
  | { state: "saving" }
  | { state: "saved"; at: number }
  | { state: "error"; message: string };

export type ProgressSaveState =
  | { state: "idle" }
  | { state: "saving" }
  | { state: "saved"; at: number }
  | { state: "error"; message: string };

const buildSnapshot = (theory: string, method: string, videos: UnitVideo[]) => ({
  theory,
  method,
  videos: JSON.stringify(videos),
});

const sortTasks = (tasks: Task[]) =>
  [...tasks].sort((a, b) => {
    if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
  });

const toProgressErrorMessage = (error: unknown) => {
  const rawMessage = getApiErrorMessage(error);
  if (rawMessage === "InvalidMinOptionalCountedTasksToComplete") {
    return "Введите целое число 0 или больше.";
  }
  return rawMessage;
};

type Params = {
  unitId: string;
};

export const useTeacherUnitFetchSave = ({ unitId }: Params) => {
  const [unit, setUnit] = useState<UnitWithTasks | null>(null);
  const [courseTitle, setCourseTitle] = useState<string | null>(null);
  const [sectionTitle, setSectionTitle] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [theoryText, setTheoryText] = useState("");
  const [methodText, setMethodText] = useState("");
  const [videos, setVideos] = useState<UnitVideo[]>([]);
  const [taskOrder, setTaskOrder] = useState<Task[]>([]);
  const [saveState, setSaveState] = useState<SaveState>({ state: "idle" });
  const [progressSaveState, setProgressSaveState] = useState<ProgressSaveState>({ state: "idle" });
  const [minCountedInput, setMinCountedInput] = useState("0");
  const [isOptionalMinEditing, setIsOptionalMinEditing] = useState(false);

  const snapshotRef = useRef<ReturnType<typeof buildSnapshot> | null>(null);
  const timerRef = useRef<number | null>(null);
  const inflightRef = useRef(0);

  const fetchUnit = useCallback(async (): Promise<UnitWithTasks | null> => {
    setError(null);
    try {
      const data = await teacherApi.getUnit(unitId);

      const nextTheory = data.theoryRichLatex ?? "";
      const nextMethod = data.methodRichLatex ?? "";
      const nextVideos = data.videosJson ?? [];

      setUnit(data);
      setTheoryText(nextTheory);
      setMethodText(nextMethod);
      setVideos(nextVideos);
      setTaskOrder(sortTasks(data.tasks));
      snapshotRef.current = buildSnapshot(nextTheory, nextMethod, nextVideos);

      setSaveState({ state: "idle" });
      setMinCountedInput(String(data.minOptionalCountedTasksToComplete ?? 0));
      setIsOptionalMinEditing(data.minOptionalCountedTasksToComplete === null);
      setProgressSaveState({ state: "idle" });

      return data;
    } catch (err) {
      setError(getApiErrorMessage(err));
      return null;
    }
  }, [unitId]);

  useEffect(() => {
    void fetchUnit();
  }, [fetchUnit]);

  useEffect(() => {
    if (!unit?.sectionId) {
      setCourseTitle(null);
      setSectionTitle(null);
      return;
    }

    let cancelled = false;
    void (async () => {
      try {
        const section = await teacherApi.getSection(unit.sectionId);
        if (cancelled) return;
        setSectionTitle(section.title);

        try {
          const course = await teacherApi.getCourse(section.courseId);
          if (cancelled) return;
          setCourseTitle(course.title);
        } catch {
          if (cancelled) return;
          setCourseTitle(null);
        }
      } catch {
        if (cancelled) return;
        setSectionTitle(null);
        setCourseTitle(null);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [unit?.sectionId]);

  const scheduleAutosave = useCallback(() => {
    if (!unit) return;
    const snapshot = snapshotRef.current;
    if (!snapshot) return;

    if (timerRef.current) window.clearTimeout(timerRef.current);

    timerRef.current = window.setTimeout(async () => {
      const currentSnapshot = snapshotRef.current;
      if (!currentSnapshot) return;

      const next = buildSnapshot(theoryText, methodText, videos);
      const changedTheory = next.theory !== currentSnapshot.theory;
      const changedMethod = next.method !== currentSnapshot.method;
      const changedVideos = next.videos !== currentSnapshot.videos;
      if (!changedTheory && !changedMethod && !changedVideos) return;

      const payload: {
        theoryRichLatex?: string | null;
        methodRichLatex?: string | null;
        videosJson?: UnitVideo[] | null;
      } = {};
      if (changedTheory) payload.theoryRichLatex = theoryText;
      if (changedMethod) payload.methodRichLatex = methodText;
      if (changedVideos) payload.videosJson = videos;

      setSaveState({ state: "saving" });
      inflightRef.current += 1;
      const requestId = inflightRef.current;

      try {
        const updated = await teacherApi.updateUnit(unit.id, payload);
        if (requestId !== inflightRef.current) return;

        setUnit((prev) =>
          prev
            ? {
                ...prev,
                ...updated,
                ...(changedTheory ? { theoryRichLatex: theoryText } : null),
                ...(changedMethod ? { methodRichLatex: methodText } : null),
                ...(changedVideos ? { videosJson: videos } : null),
              }
            : prev,
        );
        snapshotRef.current = next;
        setSaveState({ state: "saved", at: Date.now() });
      } catch (err) {
        if (requestId !== inflightRef.current) return;
        setSaveState({ state: "error", message: getApiErrorMessage(err) });
      }
    }, AUTOSAVE_DEBOUNCE_MS);
  }, [methodText, theoryText, unit, videos]);

  useEffect(() => {
    scheduleAutosave();
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, [scheduleAutosave]);

  const handleProgressSave = useCallback(async () => {
    if (!unit) return false;

    const normalized = minCountedInput.trim();
    const parsed = Number(normalized);
    if (!normalized || !Number.isInteger(parsed) || parsed < 0) {
      setProgressSaveState({ state: "error", message: "Введите целое число 0 или больше." });
      return false;
    }

    setProgressSaveState({ state: "saving" });
    try {
      const updated = await teacherApi.updateUnit(unit.id, {
        minOptionalCountedTasksToComplete: parsed,
      });
      setUnit((prev) => (prev ? { ...prev, ...updated } : prev));
      setMinCountedInput(String(updated.minOptionalCountedTasksToComplete ?? parsed));
      setProgressSaveState({ state: "saved", at: Date.now() });
      return true;
    } catch (err) {
      setProgressSaveState({ state: "error", message: toProgressErrorMessage(err) });
      return false;
    }
  }, [minCountedInput, unit]);

  return {
    unit,
    setUnit,
    courseTitle,
    sectionTitle,
    error,
    setError,
    theoryText,
    setTheoryText,
    methodText,
    setMethodText,
    videos,
    setVideos,
    taskOrder,
    setTaskOrder,
    saveState,
    progressSaveState,
    setProgressSaveState,
    minCountedInput,
    setMinCountedInput,
    isOptionalMinEditing,
    setIsOptionalMinEditing,
    fetchUnit,
    handleProgressSave,
  };
};
