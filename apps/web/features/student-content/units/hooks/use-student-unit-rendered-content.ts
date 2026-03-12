import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo, useState } from "react";
import { studentApi, type StudentUnitRenderedContentResponse, type UnitWithTasks } from "@/lib/api/student";
import { learningPhotoQueryKeys } from "@/lib/query/keys";
import { getStudentErrorMessage } from "../../shared/student-errors";

export const PDF_ZOOM_MIN = 0.5;
export const PDF_ZOOM_MAX = 1.4;
export const PDF_ZOOM_STEP = 0.1;
export const PDF_ZOOM_UNIT_DEFAULT = 0.5;

type UnitRenderedContentTarget = "theory" | "method";

type Params = {
  unit: UnitWithTasks | null;
  unitId: string;
};

const hasAnyRenderableAsset = (target: UnitRenderedContentTarget, unit: UnitWithTasks | null) =>
  Boolean(
    target === "theory"
      ? unit?.theoryPdfAssetKey || unit?.theoryHtmlAssetKey
      : unit?.methodPdfAssetKey || unit?.methodHtmlAssetKey,
  );

const loadRenderedContent = async (unitId: string, target: UnitRenderedContentTarget) =>
  studentApi.getUnitRenderedContent(unitId, target, 180);

const useRenderedContentTargetQuery = ({
  target,
  unit,
  unitId,
}: {
  target: UnitRenderedContentTarget;
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
    () => [...learningPhotoQueryKeys.studentUnitRenderedContent(unit?.id ?? unitId, target), assetFingerprint] as const,
    [assetFingerprint, target, unit?.id, unitId],
  );
  const enabled = Boolean(unit?.id && hasAnyRenderableAsset(target, unit));

  const renderedQuery = useQuery({
    queryKey,
    enabled,
    queryFn: async (): Promise<StudentUnitRenderedContentResponse | null> => {
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
    error: renderedQuery.isError ? getStudentErrorMessage(renderedQuery.error) : null,
    refresh,
  };
};

export const useStudentUnitRenderedContent = ({ unit, unitId }: Params) => {
  const [pdfZoomByTarget, setPdfZoomByTarget] = useState<Record<UnitRenderedContentTarget, number>>({
    theory: PDF_ZOOM_UNIT_DEFAULT,
    method: PDF_ZOOM_UNIT_DEFAULT,
  });

  const theory = useRenderedContentTargetQuery({ target: "theory", unit, unitId });
  const method = useRenderedContentTargetQuery({ target: "method", unit, unitId });

  const setPdfZoom = useCallback((target: UnitRenderedContentTarget, zoom: number) => {
    const clamped = Math.max(PDF_ZOOM_MIN, Math.min(PDF_ZOOM_MAX, zoom));
    setPdfZoomByTarget((prev) => ({ ...prev, [target]: clamped }));
  }, []);

  return {
    pdfZoomByTarget,
    setPdfZoom,
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
