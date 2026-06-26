import { describe, expect, it } from "vitest";
import {
  MultiChoiceAttemptRequestSchema,
  NumericAttemptRequestSchema,
  SingleChoiceAttemptRequestSchema,
  StudentAttemptRequestSchema,
  StudentAttemptResponseSchema,
  StudentPhotoPresignUploadRequestSchema,
  StudentPhotoBoardPresignUploadRequestSchema,
  StudentPhotoBoardPresignUploadResponseSchema,
  StudentPhotoBoardSubmitRequestSchema,
  StudentPhotoSubmitRequestSchema,
  TeacherPhotoInboxQuerySchema,
  TeacherPhotoQueueQuerySchema,
  TeacherReviewInboxResponseSchema,
  TeacherReviewSubmissionDetailResponseSchema,
} from "../src/contracts/learning-photo";

describe("learning-photo contracts", () => {
  it("accepts lenient student attempt envelope", () => {
    const parsed = StudentAttemptRequestSchema.parse({ random: true, choiceKey: "A" });

    expect(parsed).toMatchObject({ random: true, choiceKey: "A" });
  });

  it("validates numeric/single/multi attempt request shapes", () => {
    expect(
      NumericAttemptRequestSchema.parse({
        answers: [{ partKey: "x1", value: "42" }],
      }),
    ).toEqual({ answers: [{ partKey: "x1", value: "42" }] });

    expect(SingleChoiceAttemptRequestSchema.parse({ choiceKey: "A" })).toEqual({
      choiceKey: "A",
    });

    expect(MultiChoiceAttemptRequestSchema.parse({ choiceKeys: ["A", "B"] })).toEqual({
      choiceKeys: ["A", "B"],
    });
  });

  it("rejects invalid photo upload/submit payloads", () => {
    const uploadResult = StudentPhotoPresignUploadRequestSchema.safeParse({
      files: new Array(6).fill({
        filename: "p.jpg",
        contentType: "image/jpeg",
        sizeBytes: 10,
      }),
    });

    const submitResult = StudentPhotoSubmitRequestSchema.safeParse({
      assetKeys: ["bad key with spaces"],
    });

    expect(uploadResult.success).toBe(false);
    expect(submitResult.success).toBe(false);
  });

  it("validates board upload/submit payloads for photo tasks", () => {
    expect(
      StudentPhotoBoardPresignUploadRequestSchema.parse({
        jsonSizeBytes: 1024,
        previewSizeBytes: 2048,
        ttlSec: "300",
      }),
    ).toEqual({
      jsonSizeBytes: 1024,
      previewSizeBytes: 2048,
      ttlSec: 300,
    });

    expect(
      StudentPhotoBoardSubmitRequestSchema.parse({
        boardAssetKey: "tasks/task-1/photo/student-1/rev-1/board/1700000000000-deadbeef-1.json",
        boardPreviewAssetKey: "tasks/task-1/photo/student-1/rev-1/board/1700000000000-deadbeef-2.png",
      }),
    ).toMatchObject({
      boardAssetKey: expect.stringContaining(".json"),
      boardPreviewAssetKey: expect.stringContaining(".png"),
    });

    expect(
      StudentPhotoBoardPresignUploadRequestSchema.safeParse({
        jsonSizeBytes: 6 * 1024 * 1024,
        previewSizeBytes: 1024,
      }).success,
    ).toBe(false);
    expect(
      StudentPhotoBoardSubmitRequestSchema.safeParse({
        boardAssetKey: "bad key.json",
        boardPreviewAssetKey: "preview.png",
      }).success,
    ).toBe(false);
  });

  it("parses board presign and teacher review responses", () => {
    expect(
      StudentPhotoBoardPresignUploadResponseSchema.parse({
        board: {
          assetKey: "tasks/task-1/photo/student-1/rev-1/board/1700000000000-deadbeef-1.json",
          url: "https://storage.test/board.json",
          contentType: "application/json",
        },
        preview: {
          assetKey: "tasks/task-1/photo/student-1/rev-1/board/1700000000000-deadbeef-2.png",
          url: "https://storage.test/preview.png",
          contentType: "image/png",
        },
        expiresInSec: 300,
      }),
    ).toMatchObject({
      board: { contentType: "application/json" },
      preview: { contentType: "image/png" },
    });

    const parsed = TeacherReviewSubmissionDetailResponseSchema.parse({
      submission: {
        submissionId: "submission-1",
        status: "pending_review",
        submittedAt: "2026-06-26T00:00:00.000Z",
        reviewedAt: null,
        rejectedReason: null,
        answerKind: "board",
        assetKeys: [],
        boardAssetKey: "board.json",
        boardPreviewAssetKey: "preview.png",
        student: { id: "student-1", login: "student1", firstName: null, lastName: null },
        course: { id: "course-1", title: "Course" },
        section: { id: "section-1", title: "Section" },
        unit: { id: "unit-1", title: "Unit" },
        task: { id: "task-1", title: null, sortOrder: 0, statementLite: "Task" },
      },
      navigation: { prevSubmissionId: null, nextSubmissionId: null },
      appliedFilters: { sort: "oldest" },
    });

    expect(parsed.submission.answerKind).toBe("board");
    expect(parsed.submission.boardPreviewAssetKey).toBe("preview.png");
  });

  it("applies queue/inbox query defaults and transforms", () => {
    expect(TeacherPhotoQueueQuerySchema.parse({})).toEqual({
      status: "submitted",
      limit: 20,
      offset: 0,
    });

    expect(TeacherPhotoQueueQuerySchema.parse({ status: "pending_review", limit: "500" })).toEqual({
      status: "submitted",
      limit: 100,
      offset: 0,
    });

    expect(TeacherPhotoInboxQuerySchema.parse({ status: "submitted" }).status).toBe("pending_review");
  });

  it("rejects invalid response/query payloads", () => {
    const inboxQueryResult = TeacherPhotoInboxQuerySchema.safeParse({ sort: "wrong" });
    const reviewResponseResult = TeacherReviewInboxResponseSchema.safeParse({
      items: [],
      total: 0,
      limit: 50,
      offset: 0,
      sort: "invalid",
    });
    const attemptResponseResult = StudentAttemptResponseSchema.safeParse({
      status: "correct",
      wrongAttempts: 0,
      blockedUntil: null,
    });

    expect(inboxQueryResult.success).toBe(false);
    expect(reviewResponseResult.success).toBe(false);
    expect(attemptResponseResult.success).toBe(false);
  });
});
