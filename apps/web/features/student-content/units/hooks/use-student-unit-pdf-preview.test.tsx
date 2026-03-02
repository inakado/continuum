import { QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { studentApi, type UnitWithTasks } from "@/lib/api/student";
import type * as StudentApiModule from "@/lib/api/student";
import { createQueryClient } from "@/lib/query/query-client";
import {
  PDF_ZOOM_DEFAULT,
  PDF_ZOOM_MAX,
  PDF_ZOOM_MIN,
  PDF_ZOOM_UNIT_DEFAULT,
  useStudentUnitPdfPreview,
} from "./use-student-unit-pdf-preview";

vi.mock("@/lib/api/student", async () => {
  const actual = await vi.importActual<typeof StudentApiModule>("@/lib/api/student");
  return {
    ...actual,
    studentApi: {
      ...actual.studentApi,
      getUnitPdfPresignedUrl: vi.fn(),
    },
  };
});

const createUnit = (overrides: Partial<UnitWithTasks> = {}): UnitWithTasks =>
  ({
    id: "unit-1",
    sectionId: "section-1",
    title: "Юнит",
    description: null,
    theoryPdfAssetKey: "theory-key",
    methodPdfAssetKey: "method-key",
    tasks: [],
    status: "published",
    sortOrder: 0,
    minOptionalCountedTasksToComplete: null,
    createdAt: "2026-03-01T00:00:00.000Z",
    updatedAt: "2026-03-01T00:00:00.000Z",
    ...overrides,
  }) as UnitWithTasks;

const createWrapper = () => {
  const queryClient = createQueryClient();
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  return { queryClient, Wrapper };
};

describe("useStudentUnitPdfPreview", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.mocked(studentApi.getUnitPdfPresignedUrl).mockReset();
  });

  it("loads theory and method preview URLs from query responses", async () => {
    vi.mocked(studentApi.getUnitPdfPresignedUrl)
      .mockResolvedValueOnce({ ok: true, target: "theory", key: "theory-key", expiresInSec: 180, url: "https://cdn/theory.pdf" } as never)
      .mockResolvedValueOnce({ ok: true, target: "method", key: "method-key", expiresInSec: 180, url: "https://cdn/method.pdf" } as never);

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useStudentUnitPdfPreview({ unit: createUnit(), unitId: "unit-1" }), {
      wrapper: Wrapper,
    });

    await waitFor(() => {
      expect(result.current.theoryPreviewUrl).toBe("https://cdn/theory.pdf");
      expect(result.current.methodPreviewUrl).toBe("https://cdn/method.pdf");
    });

    expect(vi.mocked(studentApi.getUnitPdfPresignedUrl).mock.calls).toEqual([
      ["unit-1", "theory", 180],
      ["unit-1", "method", 180],
    ]);
  });

  it("returns null previews when asset keys are missing", async () => {
    const { Wrapper } = createWrapper();
    const { result } = renderHook(
      () =>
        useStudentUnitPdfPreview({
          unit: createUnit({ theoryPdfAssetKey: null, methodPdfAssetKey: null }),
          unitId: "unit-1",
        }),
      { wrapper: Wrapper },
    );

    await waitFor(() => {
      expect(result.current.theoryPreviewLoading).toBe(false);
      expect(result.current.methodPreviewLoading).toBe(false);
    });

    expect(result.current.theoryPreviewUrl).toBeNull();
    expect(result.current.methodPreviewUrl).toBeNull();
    expect(studentApi.getUnitPdfPresignedUrl).not.toHaveBeenCalled();
  });

  it("refreshes theory preview URL through query cache", async () => {
    vi.mocked(studentApi.getUnitPdfPresignedUrl)
      .mockResolvedValueOnce({ ok: true, target: "theory", key: "theory-key", expiresInSec: 180, url: "https://cdn/theory-v1.pdf" } as never)
      .mockResolvedValueOnce({ ok: true, target: "method", key: "method-key", expiresInSec: 180, url: "https://cdn/method.pdf" } as never)
      .mockResolvedValueOnce({ ok: true, target: "theory", key: "theory-key", expiresInSec: 180, url: "https://cdn/theory-v2.pdf" } as never)
      .mockResolvedValueOnce({ ok: true, target: "theory", key: "theory-key", expiresInSec: 180, url: "https://cdn/theory-v2.pdf" } as never);

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useStudentUnitPdfPreview({ unit: createUnit(), unitId: "unit-1" }), {
      wrapper: Wrapper,
    });

    await waitFor(() => {
      expect(result.current.theoryPreviewUrl).toBe("https://cdn/theory-v1.pdf");
    });

    let refreshedUrl: string | null = null;
    await act(async () => {
      refreshedUrl = await result.current.refreshTheoryPreviewUrl();
    });

    expect(refreshedUrl).toBe("https://cdn/theory-v2.pdf");
    expect(vi.mocked(studentApi.getUnitPdfPresignedUrl).mock.calls.at(-1)).toEqual(["unit-1", "theory", 180]);
  });

  it("clamps PDF zoom to supported range", () => {
    const { Wrapper } = createWrapper();
    const { result } = renderHook(
      () =>
        useStudentUnitPdfPreview({
          unit: createUnit({ theoryPdfAssetKey: null, methodPdfAssetKey: null }),
          unitId: "unit-1",
        }),
      { wrapper: Wrapper },
    );

    expect(result.current.pdfZoomByTarget.theory).toBe(PDF_ZOOM_UNIT_DEFAULT);
    expect(result.current.pdfZoomByTarget.method).toBe(PDF_ZOOM_UNIT_DEFAULT);

    act(() => {
      result.current.setPdfZoom("theory", PDF_ZOOM_MAX + 1);
      result.current.setPdfZoom("method", PDF_ZOOM_MIN - 1);
    });

    expect(result.current.pdfZoomByTarget.theory).toBe(PDF_ZOOM_MAX);
    expect(result.current.pdfZoomByTarget.method).toBe(PDF_ZOOM_MIN);
  });
});
