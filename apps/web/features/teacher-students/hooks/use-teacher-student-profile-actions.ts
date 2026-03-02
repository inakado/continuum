import { useCallback } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { teacherApi, type TeacherStudentTreeTask } from "@/lib/api/teacher";
import { contentQueryKeys } from "@/lib/query/keys";
import { formatApiErrorPayload } from "@/features/teacher-content/shared/api-errors";

export const useTeacherStudentProfileActions = ({
  onRefreshStudents,
  setActionError,
  setActionNotice,
  setCreditBusyTaskId,
  setOverrideBusyUnitId,
  studentId,
}: {
  onRefreshStudents?: () => Promise<void>;
  setActionError: (value: string | null) => void;
  setActionNotice: (value: string | null) => void;
  setCreditBusyTaskId: (value: string | null) => void;
  setOverrideBusyUnitId: (value: string | null) => void;
  studentId: string;
}) => {
  const queryClient = useQueryClient();
  const overrideOpenMutation = useMutation({
    mutationFn: (unitId: string) => teacherApi.overrideOpenUnit(studentId, unitId),
  });
  const creditTaskMutation = useMutation({
    mutationFn: (taskId: string) => teacherApi.creditTask(studentId, taskId),
  });

  const invalidateStudentProfile = useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: contentQueryKeys.teacherStudentProfileRoot(studentId),
      }),
      queryClient.invalidateQueries({
        queryKey: contentQueryKeys.teacherStudentReviewPendingTotal(studentId),
      }),
    ]);
    void onRefreshStudents?.();
  }, [onRefreshStudents, queryClient, studentId]);

  const handleOverrideOpenUnit = useCallback(
    async (unitId: string, isBusy: boolean) => {
      if (isBusy) return;
      setOverrideBusyUnitId(unitId);
      setActionError(null);
      setActionNotice(null);
      try {
        await overrideOpenMutation.mutateAsync(unitId);
        setActionNotice("Доступ к юниту открыт вручную. Статусы обновлены.");
        await invalidateStudentProfile();
      } catch (err) {
        setActionError(formatApiErrorPayload(err));
      } finally {
        setOverrideBusyUnitId(null);
      }
    },
    [
      invalidateStudentProfile,
      overrideOpenMutation,
      setActionError,
      setActionNotice,
      setOverrideBusyUnitId,
    ],
  );

  const handleCreditTask = useCallback(
    async (task: TeacherStudentTreeTask, busyTaskId: string | null) => {
      if (busyTaskId) return;
      setCreditBusyTaskId(task.id);
      setActionError(null);
      setActionNotice(null);
      try {
        await creditTaskMutation.mutateAsync(task.id);
        setActionNotice("Задача зачтена. Прогресс и доступность пересчитаны.");
        await invalidateStudentProfile();
      } catch (err) {
        setActionError(formatApiErrorPayload(err));
      } finally {
        setCreditBusyTaskId(null);
      }
    },
    [creditTaskMutation, invalidateStudentProfile, setActionError, setActionNotice, setCreditBusyTaskId],
  );

  return {
    handleCreditTask,
    handleOverrideOpenUnit,
  };
};
