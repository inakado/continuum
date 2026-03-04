import { QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { teacherApi, type UnitWithTasks } from "@/lib/api/teacher";
import type * as TeacherApiModule from "@/lib/api/teacher";
import { createQueryClient } from "@/lib/query/query-client";
import { useTeacherUnitRenderedContent } from "./use-teacher-unit-rendered-content";

vi.mock("@/lib/api/teacher", async () => {
  const actual = await vi.importActual<typeof TeacherApiModule>("@/lib/api/teacher");
  return {
    ...actual,
    teacherApi: {
      ...actual.teacherApi,
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

describe("useTeacherUnitRenderedContent", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.mocked(teacherApi.getUnitRenderedContent).mockReset();
  });

  it("loads theory and method rendered content for teacher preview", async () => {
    vi.mocked(teacherApi.getUnitRenderedContent)
      .mockResolvedValueOnce({
        ok: true,
        target: "theory",
        html: "<p>theory</p>",
        htmlKey: "theory-html-key",
        pdfUrl: "https://cdn/theory.pdf",
        pdfKey: "theory-key",
        expiresInSec: 600,
      } as never)
      .mockResolvedValueOnce({
        ok: true,
        target: "method",
        html: "<p>method</p>",
        htmlKey: "method-html-key",
        pdfUrl: "https://cdn/method.pdf",
        pdfKey: "method-key",
        expiresInSec: 600,
      } as never);

    const { Wrapper } = createWrapper();
    const { result } = renderHook(
      () => useTeacherUnitRenderedContent({ unit: createUnit(), unitId: "unit-1" }),
      { wrapper: Wrapper },
    );

    await waitFor(() => {
      expect(result.current.theoryContent?.html).toBe("<p>theory</p>");
      expect(result.current.methodContent?.html).toBe("<p>method</p>");
    });
  });

  it("refreshes theory rendered content with fresh signed asset urls", async () => {
    vi.mocked(teacherApi.getUnitRenderedContent)
      .mockResolvedValueOnce({
        ok: true,
        target: "theory",
        html: "<p>v1</p>",
        htmlKey: "theory-html-key",
        pdfUrl: "https://cdn/theory-v1.pdf",
        pdfKey: "theory-key",
        expiresInSec: 600,
      } as never)
      .mockResolvedValueOnce({
        ok: true,
        target: "method",
        html: null,
        htmlKey: null,
        pdfUrl: "https://cdn/method.pdf",
        pdfKey: "method-key",
        expiresInSec: 600,
      } as never)
      .mockResolvedValueOnce({
        ok: true,
        target: "theory",
        html: "<p>v2</p>",
        htmlKey: "theory-html-key",
        pdfUrl: "https://cdn/theory-v2.pdf",
        pdfKey: "theory-key",
        expiresInSec: 600,
      } as never)
      .mockResolvedValue({
        ok: true,
        target: "method",
        html: null,
        htmlKey: null,
        pdfUrl: "https://cdn/method.pdf",
        pdfKey: "method-key",
        expiresInSec: 600,
      } as never);

    const { Wrapper } = createWrapper();
    const { result } = renderHook(
      () => useTeacherUnitRenderedContent({ unit: createUnit(), unitId: "unit-1" }),
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
});
