import { describe, expect, it } from "vitest";
import {
  TaskStatementImageApplyRequestSchema,
  TaskStatementImageAllowedContentTypes,
  TaskStatementImageMaxSizeBytes,
  TaskStatementImagePresignUploadResponseSchema,
  TaskStatementImagePresignViewQuerySchema,
  TeacherTaskStatementImagePresignUploadRequestSchema,
} from "../src/contracts/content-assets";

describe("content assets contracts", () => {
  it("accepts task statement image upload request in envelope and direct body forms", () => {
    expect(
      TeacherTaskStatementImagePresignUploadRequestSchema.parse({
        file: {
          filename: "diagram.png",
          contentType: "image/png",
          sizeBytes: 1024,
        },
        ttlSec: 300,
      }),
    ).toEqual({
      file: {
        filename: "diagram.png",
        contentType: "image/png",
        sizeBytes: 1024,
      },
      ttlSec: 300,
    });

    expect(
      TeacherTaskStatementImagePresignUploadRequestSchema.parse({
        filename: "diagram.webp",
        contentType: "image/webp",
        sizeBytes: 2048,
      }),
    ).toEqual({
      file: {
        filename: "diagram.webp",
        contentType: "image/webp",
        sizeBytes: 2048,
      },
    });
  });

  it("rejects invalid task statement image request fields", () => {
    expect(
      TeacherTaskStatementImagePresignUploadRequestSchema.safeParse({
        file: {
          filename: "",
          contentType: TaskStatementImageAllowedContentTypes[0],
          sizeBytes: 1,
        },
      }).success,
    ).toBe(false);

    expect(
      TeacherTaskStatementImagePresignUploadRequestSchema.safeParse({
        file: {
          filename: "diagram.png",
          contentType: "image/gif",
          sizeBytes: 1,
        },
      }).success,
    ).toBe(false);

    expect(
      TeacherTaskStatementImagePresignUploadRequestSchema.safeParse({
        file: {
          filename: "diagram.png",
          contentType: "image/png",
          sizeBytes: TaskStatementImageMaxSizeBytes + 1,
        },
      }).success,
    ).toBe(false);

    expect(TaskStatementImagePresignViewQuerySchema.safeParse({ ttlSec: "0" }).success).toBe(false);
    expect(TaskStatementImageApplyRequestSchema.safeParse({ assetKey: "" }).success).toBe(false);
  });

  it("rejects invalid task statement image upload response shape", () => {
    const result = TaskStatementImagePresignUploadResponseSchema.safeParse({
      uploadUrl: "https://storage.example/upload",
      assetKey: "tasks/t1/revisions/r1/statement-image/file.png",
      expiresInSec: "300",
    });

    expect(result.success).toBe(false);
  });
});
