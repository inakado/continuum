import { describe, expect, it } from "vitest";
import {
  MultiChoiceAttemptRequestSchema,
  NumericAttemptRequestSchema,
  SingleChoiceAttemptRequestSchema,
  StudentAttemptRequestSchema,
  StudentAttemptResponseSchema,
  StudentPhotoPresignUploadRequestSchema,
  StudentPhotoSubmitRequestSchema,
  TeacherPhotoInboxQuerySchema,
  TeacherPhotoQueueQuerySchema,
  TeacherReviewInboxResponseSchema,
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
