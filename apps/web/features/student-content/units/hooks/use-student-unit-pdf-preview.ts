import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo, useState } from "react";
import { studentApi, type UnitWithTasks } from "@/lib/api/student";
import { learningPhotoQueryKeys } from "@/lib/query/keys";
import { getStudentErrorMessage } from "../../shared/student-errors";

export const PDF_ZOOM_MIN = 0.5;
export const PDF_ZOOM_MAX = 1.4;
export const PDF_ZOOM_STEP = 0.1;
export const PDF_ZOOM_DEFAULT = 0.8;

export type PdfPreviewTarget = "theory" | "method";

type Params = {
  unit: UnitWithTasks | null;
  unitId: string;
};

const buildPreviewQueryKey = (
  target: PdfPreviewTarget,
  unit: UnitWithTasks | null,
  unitId: string,
) =>
  [
    ...learningPhotoQueryKeys.studentUnitPdfPreview(unit?.id ?? unitId, target),
    target === "theory" ? (unit?.theoryPdfAssetKey ?? null) : (unit?.methodPdfAssetKey ?? null),
  ] as const;

const hasPreviewAsset = (target: PdfPreviewTarget, unit: UnitWithTasks | null) =>
  Boolean(target === "theory" ? unit?.theoryPdfAssetKey : unit?.methodPdfAssetKey);

const loadPreviewUrl = async (unitId: string, target: PdfPreviewTarget) => {
  const response = await studentApi.getUnitPdfPresignedUrl(unitId, target, 180);
  return response.url ?? null;
};

const usePdfPreviewTargetQuery = ({
  target,
  unit,
  unitId,
}: {
  target: PdfPreviewTarget;
  unit: UnitWithTasks | null;
  unitId: string;
}) => {
  const queryClient = useQueryClient();
  const queryKey = useMemo(() => buildPreviewQueryKey(target, unit, unitId), [target, unit?.id, unit?.theoryPdfAssetKey, unit?.methodPdfAssetKey, unitId]);
  const enabled = Boolean(unit?.id && hasPreviewAsset(target, unit));

  const previewQuery = useQuery({
    queryKey,
    enabled,
    queryFn: async () => {
      if (!unit?.id) return null;
      return loadPreviewUrl(unit.id, target);
    },
  });

  const refreshPreviewUrl = useCallback(async () => {
    if (!unit?.id || !hasPreviewAsset(target, unit)) return null;
    await queryClient.invalidateQueries({ queryKey, exact: true });
    return queryClient.fetchQuery({
      queryKey,
      queryFn: () => loadPreviewUrl(unit.id, target),
      staleTime: 0,
    });
  }, [queryClient, queryKey, target, unit]);

  return {
    previewUrl: previewQuery.data ?? null,
    previewLoading: enabled && previewQuery.isPending,
    previewError: previewQuery.isError ? getStudentErrorMessage(previewQuery.error) : null,
    refreshPreviewUrl,
  };
};

export const useStudentUnitPdfPreview = ({ unit, unitId }: Params) => {
  const [pdfZoomByTarget, setPdfZoomByTarget] = useState<Record<PdfPreviewTarget, number>>({
    theory: PDF_ZOOM_DEFAULT,
    method: PDF_ZOOM_DEFAULT,
  });

  const theoryPreview = usePdfPreviewTargetQuery({ target: "theory", unit, unitId });
  const methodPreview = usePdfPreviewTargetQuery({ target: "method", unit, unitId });

  const setPdfZoom = useCallback((target: PdfPreviewTarget, zoom: number) => {
    const clamped = Math.max(PDF_ZOOM_MIN, Math.min(PDF_ZOOM_MAX, zoom));
    setPdfZoomByTarget((prev) => ({ ...prev, [target]: clamped }));
  }, []);

  return {
    pdfZoomByTarget,
    setPdfZoom,
    theoryPreviewUrl: theoryPreview.previewUrl,
    methodPreviewUrl: methodPreview.previewUrl,
    theoryPreviewLoading: theoryPreview.previewLoading,
    methodPreviewLoading: methodPreview.previewLoading,
    theoryPreviewError: theoryPreview.previewError,
    methodPreviewError: methodPreview.previewError,
    refreshTheoryPreviewUrl: theoryPreview.refreshPreviewUrl,
    refreshMethodPreviewUrl: methodPreview.refreshPreviewUrl,
  };
};
