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

export const useStudentUnitPdfPreview = ({ unit, unitId }: Params) => {
  const queryClient = useQueryClient();
  const [pdfZoomByTarget, setPdfZoomByTarget] = useState<Record<PdfPreviewTarget, number>>({
    theory: PDF_ZOOM_DEFAULT,
    method: PDF_ZOOM_DEFAULT,
  });

  const theoryPreviewQueryKey = useMemo(
    () => [
      ...learningPhotoQueryKeys.studentUnitPdfPreview(unit?.id ?? unitId, "theory"),
      unit?.theoryPdfAssetKey ?? null,
    ] as const,
    [unit?.id, unit?.theoryPdfAssetKey, unitId],
  );

  const methodPreviewQueryKey = useMemo(
    () => [
      ...learningPhotoQueryKeys.studentUnitPdfPreview(unit?.id ?? unitId, "method"),
      unit?.methodPdfAssetKey ?? null,
    ] as const,
    [unit?.id, unit?.methodPdfAssetKey, unitId],
  );

  const theoryPreviewQuery = useQuery({
    queryKey: theoryPreviewQueryKey,
    enabled: Boolean(unit?.id && unit?.theoryPdfAssetKey),
    queryFn: async () => {
      if (!unit?.id) return null;
      const response = await studentApi.getUnitPdfPresignedUrl(unit.id, "theory", 180);
      return response.url ?? null;
    },
  });

  const methodPreviewQuery = useQuery({
    queryKey: methodPreviewQueryKey,
    enabled: Boolean(unit?.id && unit?.methodPdfAssetKey),
    queryFn: async () => {
      if (!unit?.id) return null;
      const response = await studentApi.getUnitPdfPresignedUrl(unit.id, "method", 180);
      return response.url ?? null;
    },
  });

  const refreshTheoryPreviewUrl = useCallback(async () => {
    if (!unit?.id || !unit?.theoryPdfAssetKey) return null;
    const nextUrl = await queryClient.fetchQuery({
      queryKey: theoryPreviewQueryKey,
      queryFn: async () => {
        const response = await studentApi.getUnitPdfPresignedUrl(unit.id, "theory", 180);
        return response.url ?? null;
      },
    });
    return nextUrl;
  }, [queryClient, theoryPreviewQueryKey, unit?.id, unit?.theoryPdfAssetKey]);

  const refreshMethodPreviewUrl = useCallback(async () => {
    if (!unit?.id || !unit?.methodPdfAssetKey) return null;
    const nextUrl = await queryClient.fetchQuery({
      queryKey: methodPreviewQueryKey,
      queryFn: async () => {
        const response = await studentApi.getUnitPdfPresignedUrl(unit.id, "method", 180);
        return response.url ?? null;
      },
    });
    return nextUrl;
  }, [methodPreviewQueryKey, queryClient, unit?.id, unit?.methodPdfAssetKey]);

  const setPdfZoom = useCallback((target: PdfPreviewTarget, zoom: number) => {
    const clamped = Math.max(PDF_ZOOM_MIN, Math.min(PDF_ZOOM_MAX, zoom));
    setPdfZoomByTarget((prev) => ({ ...prev, [target]: clamped }));
  }, []);

  return {
    pdfZoomByTarget,
    setPdfZoom,
    theoryPreviewUrl: theoryPreviewQuery.data ?? null,
    methodPreviewUrl: methodPreviewQuery.data ?? null,
    theoryPreviewLoading: Boolean(unit?.theoryPdfAssetKey) && theoryPreviewQuery.isPending,
    methodPreviewLoading: Boolean(unit?.methodPdfAssetKey) && methodPreviewQuery.isPending,
    theoryPreviewError: theoryPreviewQuery.isError ? getStudentErrorMessage(theoryPreviewQuery.error) : null,
    methodPreviewError: methodPreviewQuery.isError ? getStudentErrorMessage(methodPreviewQuery.error) : null,
    refreshTheoryPreviewUrl,
    refreshMethodPreviewUrl,
  };
};
