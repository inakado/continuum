import { QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { studentApi, type UnitWithTasks } from "@/lib/api/student";
import type * as StudentApiModule from "@/lib/api/student";
import { createQueryClient } from "@/lib/query/query-client";
import {
  PDF_ZOOM_MAX,
  PDF_ZOOM_MIN,
  PDF_ZOOM_UNIT_DEFAULT,
  useStudentUnitRenderedContent,
} from "./use-student-unit-rendered-content";

vi.mock("@/lib/api/student", async () => {
  const actual = await vi.importActual<typeof StudentApiModule>("@/lib/api/student");
  return {
    ...actual,
    studentApi: {
      ...actual.studentApi,
      getUnitRenderedContent: vi.fn(),
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
    theoryHtmlAssetKey: "theory-html-key",
    methodPdfAssetKey: "method-key",
    methodHtmlAssetKey: "method-html-key",
    tasks: [],
    status: "published",
    sortOrder: 0,
    minOptionalCountedTasksToComplete: 0,
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

describe("useStudentUnitRenderedContent", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.mocked(studentApi.getUnitRenderedContent).mockReset();
  });

  it("loads theory and method rendered content", async () => {
    vi.mocked(studentApi.getUnitRenderedContent)
      .mockResolvedValueOnce({
        ok: true,
        target: "theory",
        html: "<p>theory</p>",
        htmlKey: "theory-html-key",
        pdfUrl: "https://cdn/theory.pdf",
        pdfKey: "theory-key",
        expiresInSec: 180,
      } as never)
      .mockResolvedValueOnce({
        ok: true,
        target: "method",
        html: null,
        htmlKey: null,
        pdfUrl: "https://cdn/method.pdf",
        pdfKey: "method-key",
        expiresInSec: 180,
      } as never);

    const { Wrapper } = createWrapper();
    const { result } = renderHook(
      () => useStudentUnitRenderedContent({ unit: createUnit(), unitId: "unit-1" }),
      { wrapper: Wrapper },
    );

    await waitFor(() => {
      expect(result.current.theoryContent?.html).toBe("<p>theory</p>");
      expect(result.current.methodContent?.pdfUrl).toBe("https://cdn/method.pdf");
    });
  });

  it("refreshes rendered content through query cache", async () => {
    vi.mocked(studentApi.getUnitRenderedContent)
      .mockResolvedValueOnce({
        ok: true,
        target: "theory",
        html: "<p>v1</p>",
        htmlKey: "theory-html-key",
        pdfUrl: "https://cdn/theory-v1.pdf",
        pdfKey: "theory-key",
        expiresInSec: 180,
      } as never)
      .mockResolvedValueOnce({
        ok: true,
        target: "method",
        html: null,
        htmlKey: null,
        pdfUrl: "https://cdn/method.pdf",
        pdfKey: "method-key",
        expiresInSec: 180,
      } as never)
      .mockResolvedValueOnce({
        ok: true,
        target: "theory",
        html: "<p>v2</p>",
        htmlKey: "theory-html-key",
        pdfUrl: "https://cdn/theory-v2.pdf",
        pdfKey: "theory-key",
        expiresInSec: 180,
      } as never)
      .mockResolvedValue({
        ok: true,
        target: "method",
        html: null,
        htmlKey: null,
        pdfUrl: "https://cdn/method.pdf",
        pdfKey: "method-key",
        expiresInSec: 180,
      } as never);

    const { Wrapper } = createWrapper();
    const { result } = renderHook(
      () => useStudentUnitRenderedContent({ unit: createUnit(), unitId: "unit-1" }),
      { wrapper: Wrapper },
    );

    await waitFor(() => {
      expect(result.current.theoryContent?.html).toBe("<p>v1</p>");
    });

    await act(async () => {
      await result.current.refreshTheoryContent();
    });

    await waitFor(() => {
      expect(result.current.theoryContent?.html).toBe("<p>v2</p>");
    });
  });

  it("clamps fallback PDF zoom state", () => {
    const { Wrapper } = createWrapper();
    const { result } = renderHook(
      () =>
        useStudentUnitRenderedContent({
          unit: createUnit({
            theoryPdfAssetKey: null,
            theoryHtmlAssetKey: null,
            methodPdfAssetKey: null,
            methodHtmlAssetKey: null,
          }),
          unitId: "unit-1",
        }),
      { wrapper: Wrapper },
    );

    expect(result.current.pdfZoomByTarget.theory).toBe(PDF_ZOOM_UNIT_DEFAULT);

    act(() => {
      result.current.setPdfZoom("theory", PDF_ZOOM_MAX + 1);
      result.current.setPdfZoom("method", PDF_ZOOM_MIN - 1);
    });

    expect(result.current.pdfZoomByTarget.theory).toBe(PDF_ZOOM_MAX);
    expect(result.current.pdfZoomByTarget.method).toBe(PDF_ZOOM_MIN);
  });
});
