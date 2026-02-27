import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ApiError } from "@/lib/api/client";
import { studentApi } from "@/lib/api/student";
import { teacherApi } from "@/lib/api/teacher";

const jsonResponse = (payload: unknown, status = 200) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: {
      "Content-Type": "application/json",
    },
  });

describe("wave1 runtime parsing", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("parses valid student photo submit response", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        ok: true,
        submissionId: "sub-1",
        taskState: {
          status: "pending_review",
          wrongAttempts: 0,
          blockedUntil: null,
          requiredSkipped: false,
        },
      }),
    );

    const response = await studentApi.submitPhoto("task-1", ["tasks/task-1/photo/student/rev/file.png"]);

    expect(response.ok).toBe(true);
    expect(response.submissionId).toBe("sub-1");
  });

  it("throws API_RESPONSE_INVALID when student attempt response shape is broken", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ ok: true }));

    await expect(
      studentApi.submitAttempt("task-1", {
        choiceKey: "A",
      }),
    ).rejects.toMatchObject({
      code: "API_RESPONSE_INVALID",
    } satisfies Partial<ApiError>);
  });

  it("throws API_RESPONSE_INVALID for invalid teacher inbox payload", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ items: [] }));

    await expect(teacherApi.listTeacherPhotoInbox()).rejects.toMatchObject({
      code: "API_RESPONSE_INVALID",
    } satisfies Partial<ApiError>);
  });
});
