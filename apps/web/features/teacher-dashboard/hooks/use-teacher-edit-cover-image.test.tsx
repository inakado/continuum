import { QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ChangeEvent, ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { teacherApi } from "@/lib/api/teacher";
import type * as TeacherApiModule from "@/lib/api/teacher";
import { createQueryClient } from "@/lib/query/query-client";
import { useTeacherEditCoverImage } from "./use-teacher-edit-cover-image";

vi.mock("@/lib/api/teacher", async () => {
  const actual = await vi.importActual<typeof TeacherApiModule>("@/lib/api/teacher");
  return {
    ...actual,
    teacherApi: {
      ...actual.teacherApi,
      presignCourseCoverImageView: vi.fn(),
      presignCourseCoverImageUpload: vi.fn(),
      applyCourseCoverImage: vi.fn(),
      deleteCourseCoverImage: vi.fn(),
      presignSectionCoverImageView: vi.fn(),
      presignSectionCoverImageUpload: vi.fn(),
      applySectionCoverImage: vi.fn(),
      deleteSectionCoverImage: vi.fn(),
    },
  };
});

const createWrapper = () => {
  const queryClient = createQueryClient();
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  return { queryClient, Wrapper };
};

const createFileChangeEvent = (file: File): ChangeEvent<HTMLInputElement> =>
  ({
    target: { files: [file] },
    currentTarget: { value: "fake-path" },
  }) as unknown as ChangeEvent<HTMLInputElement>;

describe("useTeacherEditCoverImage", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.mocked(teacherApi.presignCourseCoverImageView).mockReset();
    vi.mocked(teacherApi.presignCourseCoverImageUpload).mockReset();
    vi.mocked(teacherApi.applyCourseCoverImage).mockReset();
    vi.mocked(teacherApi.deleteCourseCoverImage).mockReset();
    vi.mocked(teacherApi.presignSectionCoverImageView).mockReset();
    vi.mocked(teacherApi.presignSectionCoverImageUpload).mockReset();
    vi.mocked(teacherApi.applySectionCoverImage).mockReset();
    vi.mocked(teacherApi.deleteSectionCoverImage).mockReset();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
      }),
    );
  });

  it("loads course preview URL when cover image key exists", async () => {
    vi.mocked(teacherApi.presignCourseCoverImageView).mockResolvedValue({
      ok: true,
      courseId: "course-1",
      key: "course-cover-key",
      expiresInSec: 600,
      url: "https://cdn.example.com/course-cover.webp",
    } as never);

    const { Wrapper } = createWrapper();
    const { result } = renderHook(
      () =>
        useTeacherEditCoverImage({
          editingEntity: {
            kind: "course",
            id: "course-1",
            assetKey: "course-cover-key",
          },
          onAfterChange: vi.fn(),
        }),
      { wrapper: Wrapper },
    );

    await waitFor(() => {
      expect(result.current.coverImageState.previewUrl).toBe("https://cdn.example.com/course-cover.webp");
    });

    expect(teacherApi.presignCourseCoverImageView).toHaveBeenCalledWith("course-1", 600);
  });

  it("uploads section cover image and refreshes entity data", async () => {
    const onAfterChange = vi.fn().mockResolvedValue(null);
    vi.mocked(teacherApi.presignSectionCoverImageUpload).mockResolvedValue({
      assetKey: "section-cover-next",
      uploadUrl: "https://upload.example.com/object",
      headers: {},
      expiresInSec: 600,
    } as never);
    vi.mocked(teacherApi.applySectionCoverImage).mockResolvedValue({
      ok: true,
      sectionId: "section-1",
      assetKey: "section-cover-next",
    } as never);
    vi.mocked(teacherApi.presignSectionCoverImageView).mockResolvedValue({
      ok: true,
      sectionId: "section-1",
      key: "section-cover-next",
      expiresInSec: 600,
      url: "https://cdn.example.com/section-cover-next.webp",
    } as never);

    const { Wrapper } = createWrapper();
    const { result } = renderHook(
      () =>
        useTeacherEditCoverImage({
          editingEntity: {
            kind: "section",
            id: "section-1",
            assetKey: null,
          },
          onAfterChange,
        }),
      { wrapper: Wrapper },
    );

    await act(async () => {
      await result.current.handleCoverImageSelected(
        createFileChangeEvent(new File(["image"], "cover.webp", { type: "image/webp" })),
      );
    });

    expect(teacherApi.presignSectionCoverImageUpload).toHaveBeenCalledWith("section-1", {
      filename: "cover.webp",
      contentType: "image/webp",
      sizeBytes: 5,
    });
    expect(teacherApi.applySectionCoverImage).toHaveBeenCalledWith("section-1", "section-cover-next");
    expect(onAfterChange).toHaveBeenCalledTimes(1);
    expect(result.current.coverImageState.previewUrl).toBe("https://cdn.example.com/section-cover-next.webp");
  });

  it("keeps preview visible after same entity receives refreshed asset key", async () => {
    const onAfterChange = vi.fn().mockResolvedValue(null);
    vi.mocked(teacherApi.presignCourseCoverImageUpload).mockResolvedValue({
      assetKey: "course-cover-next",
      uploadUrl: "https://upload.example.com/object",
      headers: {},
      expiresInSec: 600,
    } as never);
    vi.mocked(teacherApi.applyCourseCoverImage).mockResolvedValue({
      ok: true,
      courseId: "course-1",
      assetKey: "course-cover-next",
    } as never);
    vi.mocked(teacherApi.presignCourseCoverImageView).mockResolvedValue({
      ok: true,
      courseId: "course-1",
      key: "course-cover-next",
      expiresInSec: 600,
      url: "https://cdn.example.com/course-cover-next.webp",
    } as never);

    const { Wrapper } = createWrapper();
    const { result, rerender } = renderHook(
      ({ assetKey }: { assetKey: string | null }) =>
        useTeacherEditCoverImage({
          editingEntity: {
            kind: "course",
            id: "course-1",
            assetKey,
          },
          onAfterChange,
        }),
      {
        wrapper: Wrapper,
        initialProps: { assetKey: null as string | null },
      },
    );

    await act(async () => {
      await result.current.handleCoverImageSelected(
        createFileChangeEvent(new File(["image"], "cover.webp", { type: "image/webp" })),
      );
    });

    expect(result.current.coverImageState.previewUrl).toBe("https://cdn.example.com/course-cover-next.webp");

    rerender({ assetKey: "course-cover-next" });

    expect(result.current.coverImageState.previewUrl).toBe("https://cdn.example.com/course-cover-next.webp");
  });

  it("deletes course cover image and clears preview", async () => {
    const onAfterChange = vi.fn().mockResolvedValue(null);
    vi.mocked(teacherApi.presignCourseCoverImageView).mockResolvedValue({
      ok: true,
      courseId: "course-1",
      key: "course-cover-key",
      expiresInSec: 600,
      url: "https://cdn.example.com/course-cover.webp",
    } as never);
    vi.mocked(teacherApi.deleteCourseCoverImage).mockResolvedValue({
      ok: true,
      courseId: "course-1",
      assetKey: null,
    } as never);

    const { Wrapper } = createWrapper();
    const { result } = renderHook(
      () =>
        useTeacherEditCoverImage({
          editingEntity: {
            kind: "course",
            id: "course-1",
            assetKey: "course-cover-key",
          },
          onAfterChange,
        }),
      { wrapper: Wrapper },
    );

    await waitFor(() => {
      expect(result.current.coverImageState.previewUrl).toBe("https://cdn.example.com/course-cover.webp");
    });

    await act(async () => {
      await result.current.handleCoverImageRemove();
    });

    expect(teacherApi.deleteCourseCoverImage).toHaveBeenCalledWith("course-1");
    expect(onAfterChange).toHaveBeenCalledTimes(1);
    expect(result.current.coverImageState.key).toBeNull();
    expect(result.current.coverImageState.previewUrl).toBeNull();
  });
});
