import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { studentLibraryApi } from "./student-library.api";
import { useStudentPdf } from "./use-student-pdf";

vi.mock("./student-library.api", () => ({ studentLibraryApi: { getLesson: vi.fn(), getArtifactView: vi.fn() } }));
const tab = { location: { replace: vi.fn() }, close: vi.fn(), opener: {} };
beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(window, "open").mockReturnValue(tab as never);
});
afterEach(() => vi.restoreAllMocks());

it("opens the tab synchronously, blocks repeated requests and then navigates to the protected PDF", async () => {
  let complete!: (value: never) => void;
  vi.mocked(studentLibraryApi.getLesson).mockReturnValue(new Promise((resolve) => { complete = resolve; }));
  vi.mocked(studentLibraryApi.getArtifactView).mockResolvedValue({ url: "https://files.example/note.pdf" } as never);
  const { result } = renderHook(useStudentPdf);
  act(() => { void result.current.open({ lessonId: "lesson", type: "pdf" }); });
  expect(window.open).toHaveBeenCalledWith("", "_blank");
  expect(tab.opener).toBeNull();
  expect(result.current.opening).toEqual({ lessonId: "lesson", type: "pdf" });
  act(() => { void result.current.open({ lessonId: "lesson", type: "pdf" }); });
  expect(window.open).toHaveBeenCalledTimes(1);
  await act(async () => { complete({ artifacts: [{ id: "note", type: "pdf" }] } as never); });
  await waitFor(() => expect(result.current.opening).toBeNull());
  expect(studentLibraryApi.getArtifactView).toHaveBeenCalledWith("note");
  expect(tab.location.replace).toHaveBeenCalledWith("https://files.example/note.pdf");
});

it("closes a failed tab and allows retry without leaving the catalog", async () => {
  vi.mocked(studentLibraryApi.getLesson).mockRejectedValueOnce(new Error("403"));
  const { result } = renderHook(useStudentPdf);
  await act(async () => { await result.current.open({ lessonId: "lesson", type: "pdf" }); });
  expect(tab.close).toHaveBeenCalledTimes(1);
  expect(result.current.error).toBe(true);
  expect(result.current.opening).toBeNull();
  vi.mocked(studentLibraryApi.getLesson).mockResolvedValue({ artifacts: [{ id: "note", type: "pdf" }] } as never);
  vi.mocked(studentLibraryApi.getArtifactView).mockResolvedValue({ url: "https://files.example/note.pdf" } as never);
  await act(async () => { await result.current.open({ lessonId: "lesson", type: "pdf" }); });
  expect(result.current.error).toBe(false);
  expect(tab.location.replace).toHaveBeenCalledTimes(1);
});

it("does not open a different PDF when the requested published format has disappeared", async () => {
  vi.mocked(studentLibraryApi.getLesson).mockResolvedValue({ artifacts: [{ id: "tasks", type: "tasks_pdf" }] } as never);
  const { result } = renderHook(useStudentPdf);
  await act(async () => { await result.current.open({ lessonId: "lesson", type: "pdf" }); });
  expect(studentLibraryApi.getArtifactView).not.toHaveBeenCalled();
  expect(tab.close).toHaveBeenCalledTimes(1);
  expect(result.current.error).toBe(true);
});
