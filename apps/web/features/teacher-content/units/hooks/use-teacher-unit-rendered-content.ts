import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo } from "react";
import {
  teacherApi,
  type TeacherUnitRenderedContentResponse,
  type UnitWithTasks,
} from "@/lib/api/teacher";
import { contentQueryKeys } from "@/lib/query/keys";
import { getApiErrorMessage } from "../../shared/api-errors";

type TeacherUnitRenderedContentTarget = "theory" | "method";

type Params = {
  unit: UnitWithTasks | null;
  unitId: string;
};

const hasAnyRenderableAsset = (target: TeacherUnitRenderedContentTarget, unit: UnitWithTasks | null) =>
  Boolean(
    target === "theory"
      ? unit?.theoryPdfAssetKey || unit?.theoryHtmlAssetKey
      : unit?.methodPdfAssetKey || unit?.methodHtmlAssetKey,
  );

const loadRenderedContent = async (unitId: string, target: TeacherUnitRenderedContentTarget) =>
  teacherApi.getUnitRenderedContent(unitId, target, 600);

const useRenderedContentTargetQuery = ({
  target,
  unit,
  unitId,
}: {
  target: TeacherUnitRenderedContentTarget;
  unit: UnitWithTasks | null;
  unitId: string;
}) => {
  const queryClient = useQueryClient();
  const assetFingerprint = useMemo(
    () =>
      target === "theory"
        ? `${unit?.theoryPdfAssetKey ?? "null"}:${unit?.theoryHtmlAssetKey ?? "null"}`
        : `${unit?.methodPdfAssetKey ?? "null"}:${unit?.methodHtmlAssetKey ?? "null"}`,
    [
      target,
      unit?.theoryPdfAssetKey,
      unit?.theoryHtmlAssetKey,
      unit?.methodPdfAssetKey,
      unit?.methodHtmlAssetKey,
    ],
  );
  const queryKey = useMemo(
    () => [...contentQueryKeys.teacherUnitRenderedContent(unit?.id ?? unitId, target), assetFingerprint] as const,
    [assetFingerprint, target, unit?.id, unitId],
  );
  const enabled = Boolean(unit?.id && hasAnyRenderableAsset(target, unit));

  const renderedQuery = useQuery({
    queryKey,
    enabled,
    queryFn: async (): Promise<TeacherUnitRenderedContentResponse | null> => {
      if (!unit?.id) return null;
      return loadRenderedContent(unit.id, target);
    },
  });

  const refresh = useCallback(async () => {
    if (!unit?.id || !hasAnyRenderableAsset(target, unit)) return null;
    return queryClient.fetchQuery({
      queryKey,
      queryFn: () => loadRenderedContent(unit.id, target),
      staleTime: 0,
    });
  }, [queryClient, queryKey, target, unit]);

  return {
    data: renderedQuery.data ?? null,
    loading: enabled && renderedQuery.isPending,
    error: renderedQuery.isError ? getApiErrorMessage(renderedQuery.error) : null,
    refresh,
  };
};

export const useTeacherUnitRenderedContent = ({ unit, unitId }: Params) => {
  const theory = useRenderedContentTargetQuery({ target: "theory", unit, unitId });
  const method = useRenderedContentTargetQuery({ target: "method", unit, unitId });

  return {
    theoryContent: theory.data,
    theoryLoading: theory.loading,
    theoryError: theory.error,
    refreshTheoryContent: theory.refresh,
    methodContent: method.data,
    methodLoading: method.loading,
    methodError: method.error,
    refreshMethodContent: method.refresh,
  };
};
