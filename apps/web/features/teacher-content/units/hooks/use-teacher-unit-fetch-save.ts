import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
} from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { teacherApi, type Task, type UnitVideo, type UnitWithTasks } from "@/lib/api/teacher";
import { contentQueryKeys } from "@/lib/query/keys";
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

const applyEditableUnitState = ({
  data,
  setTheoryText,
  setMethodText,
  setVideos,
  setTaskOrder,
  setSaveState,
  setMinCountedInput,
  setIsOptionalMinEditing,
  setProgressSaveState,
  snapshotRef,
}: {
  data: UnitWithTasks;
  setTheoryText: Dispatch<SetStateAction<string>>;
  setMethodText: Dispatch<SetStateAction<string>>;
  setVideos: Dispatch<SetStateAction<UnitVideo[]>>;
  setTaskOrder: Dispatch<SetStateAction<Task[]>>;
  setSaveState: Dispatch<SetStateAction<SaveState>>;
  setMinCountedInput: Dispatch<SetStateAction<string>>;
  setIsOptionalMinEditing: Dispatch<SetStateAction<boolean>>;
  setProgressSaveState: Dispatch<SetStateAction<ProgressSaveState>>;
  snapshotRef: MutableRefObject<ReturnType<typeof buildSnapshot> | null>;
}) => {
  const nextTheory = data.theoryRichLatex ?? "";
  const nextMethod = data.methodRichLatex ?? "";
  const nextVideos = data.videosJson ?? [];

  setTheoryText(nextTheory);
  setMethodText(nextMethod);
  setVideos(nextVideos);
  setTaskOrder(sortTasks(data.tasks));
  snapshotRef.current = buildSnapshot(nextTheory, nextMethod, nextVideos);
  setSaveState({ state: "idle" });
  setMinCountedInput(String(data.minOptionalCountedTasksToComplete ?? 0));
  setIsOptionalMinEditing(data.minOptionalCountedTasksToComplete === null);
  setProgressSaveState({ state: "idle" });
};

type Params = {
  unitId: string;
};

const useTeacherUnitReadQueries = (unitId: string) => {
  const unitQuery = useQuery<UnitWithTasks>({
    queryKey: contentQueryKeys.teacherUnit(unitId),
    queryFn: () => teacherApi.getUnit(unitId),
  });

  const unit = unitQuery.data ?? null;

  const sectionMetaQuery = useQuery({
    queryKey: contentQueryKeys.teacherSectionMeta(unit?.sectionId ?? ""),
    queryFn: () => teacherApi.getSectionMeta(unit?.sectionId ?? ""),
    enabled: Boolean(unit?.sectionId) && !unit?.section?.courseId,
    retry: false,
  });

  const sectionCourseId = unit?.section?.courseId ?? sectionMetaQuery.data?.courseId ?? null;
  const sectionTitle = unit?.section?.title ?? sectionMetaQuery.data?.title ?? null;

  const courseQuery = useQuery({
    queryKey: contentQueryKeys.teacherCourse(sectionCourseId ?? ""),
    queryFn: () => teacherApi.getCourse(sectionCourseId ?? ""),
    enabled: Boolean(sectionCourseId),
    retry: false,
  });

  return {
    unitQuery,
    unit,
    sectionTitle,
    courseQuery,
  };
};

export const useTeacherUnitFetchSave = ({ unitId }: Params) => {
  const queryClient = useQueryClient();
  const [errorOverride, setErrorOverride] = useState<string | null>(null);
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

  const { unitQuery, unit, sectionTitle, courseQuery } = useTeacherUnitReadQueries(unitId);

  useEffect(() => {
    if (!unitQuery.data) return;
    applyEditableUnitState({
      data: unitQuery.data,
      setTheoryText,
      setMethodText,
      setVideos,
      setTaskOrder,
      setSaveState,
      setMinCountedInput,
      setIsOptionalMinEditing,
      setProgressSaveState,
      snapshotRef,
    });
    setErrorOverride(null);
  }, [unitQuery.data]);

  const updateUnitMutation = useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: string;
      payload: {
        theoryRichLatex?: string | null;
        methodRichLatex?: string | null;
        videosJson?: UnitVideo[] | null;
        minOptionalCountedTasksToComplete?: number;
      };
    }) => teacherApi.updateUnit(id, payload),
  });

  const fetchUnit = useCallback(async (): Promise<UnitWithTasks | null> => {
    setErrorOverride(null);
    try {
      const data = await queryClient.fetchQuery({
        queryKey: contentQueryKeys.teacherUnit(unitId),
        queryFn: () => teacherApi.getUnit(unitId),
        staleTime: 0,
      });
      return data;
    } catch (err) {
      setErrorOverride(getApiErrorMessage(err));
      return null;
    }
  }, [queryClient, unitId]);

  const setUnit = useCallback<Dispatch<SetStateAction<UnitWithTasks | null>>>(
    (nextValue) => {
      queryClient.setQueryData<UnitWithTasks | null>(contentQueryKeys.teacherUnit(unitId), (prev) =>
        typeof nextValue === "function" ? (nextValue as (prev: UnitWithTasks | null) => UnitWithTasks | null)(prev ?? null) : nextValue,
      );
    },
    [queryClient, unitId],
  );

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
        const updated = await updateUnitMutation.mutateAsync({ id: unit.id, payload });
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
  }, [methodText, theoryText, unit, updateUnitMutation, videos, setUnit]);

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
      const updated = await updateUnitMutation.mutateAsync({
        id: unit.id,
        payload: { minOptionalCountedTasksToComplete: parsed },
      });
      setUnit((prev) => (prev ? { ...prev, ...updated } : prev));
      setMinCountedInput(String(updated.minOptionalCountedTasksToComplete ?? parsed));
      setProgressSaveState({ state: "saved", at: Date.now() });
      return true;
    } catch (err) {
      setProgressSaveState({ state: "error", message: toProgressErrorMessage(err) });
      return false;
    }
  }, [minCountedInput, setUnit, unit, updateUnitMutation]);

  const error =
    errorOverride ??
    (unitQuery.isError ? getApiErrorMessage(unitQuery.error) : null);
  const snapshot = snapshotRef.current;
  const currentSnapshot = buildSnapshot(theoryText, methodText, videos);
  const hasUnsavedContentChanges =
    Boolean(snapshot) &&
    (currentSnapshot.theory !== snapshot?.theory ||
      currentSnapshot.method !== snapshot?.method ||
      currentSnapshot.videos !== snapshot?.videos);
  const savedOptionalMin = unit?.minOptionalCountedTasksToComplete ?? 0;
  const normalizedOptionalMin = minCountedInput.trim();
  const parsedOptionalMin = Number(normalizedOptionalMin);
  const hasUnsavedProgressChanges =
    isOptionalMinEditing &&
    (!normalizedOptionalMin ||
      !Number.isInteger(parsedOptionalMin) ||
      parsedOptionalMin < 0 ||
      parsedOptionalMin !== savedOptionalMin);
  const isDirty = hasUnsavedContentChanges || hasUnsavedProgressChanges;

  return {
    unit,
    setUnit,
    courseTitle: courseQuery.data?.title ?? null,
    sectionTitle,
    error,
    setError: setErrorOverride,
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
    isDirty,
    fetchUnit,
    handleProgressSave,
  };
};
