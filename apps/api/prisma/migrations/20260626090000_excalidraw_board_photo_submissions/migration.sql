CREATE TYPE "PhotoTaskSubmissionAnswerKind" AS ENUM ('photo', 'board');

ALTER TABLE "photo_task_submissions"
  ADD COLUMN "answer_kind" "PhotoTaskSubmissionAnswerKind" NOT NULL DEFAULT 'photo',
  ADD COLUMN "board_asset_key" TEXT,
  ADD COLUMN "board_preview_asset_key" TEXT;
