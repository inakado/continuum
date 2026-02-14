ALTER TYPE "StudentTaskStatus" ADD VALUE IF NOT EXISTS 'accepted';

CREATE TYPE "PhotoTaskSubmissionStatus" AS ENUM ('submitted', 'accepted', 'rejected');

CREATE TABLE "photo_task_submissions" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "student_user_id" UUID NOT NULL,
  "task_id" UUID NOT NULL,
  "task_revision_id" UUID NOT NULL,
  "unit_id" UUID NOT NULL,
  "attempt_id" UUID NOT NULL,
  "asset_keys_json" JSONB NOT NULL,
  "status" "PhotoTaskSubmissionStatus" NOT NULL DEFAULT 'submitted',
  "rejected_reason" TEXT,
  "reviewed_by_teacher_user_id" UUID,
  "submitted_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "reviewed_at" TIMESTAMPTZ,

  CONSTRAINT "photo_task_submissions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "photo_task_submissions_attempt_id_key"
  ON "photo_task_submissions"("attempt_id");
CREATE INDEX "photo_task_submissions_student_user_id_status_idx"
  ON "photo_task_submissions"("student_user_id", "status");
CREATE INDEX "photo_task_submissions_task_id_student_user_id_idx"
  ON "photo_task_submissions"("task_id", "student_user_id");
CREATE INDEX "photo_task_submissions_unit_id_student_user_id_idx"
  ON "photo_task_submissions"("unit_id", "student_user_id");

ALTER TABLE "photo_task_submissions"
  ADD CONSTRAINT "photo_task_submissions_student_user_id_fkey"
  FOREIGN KEY ("student_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "photo_task_submissions"
  ADD CONSTRAINT "photo_task_submissions_task_id_fkey"
  FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "photo_task_submissions"
  ADD CONSTRAINT "photo_task_submissions_task_revision_id_fkey"
  FOREIGN KEY ("task_revision_id") REFERENCES "task_revisions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "photo_task_submissions"
  ADD CONSTRAINT "photo_task_submissions_unit_id_fkey"
  FOREIGN KEY ("unit_id") REFERENCES "units"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "photo_task_submissions"
  ADD CONSTRAINT "photo_task_submissions_attempt_id_fkey"
  FOREIGN KEY ("attempt_id") REFERENCES "attempts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "photo_task_submissions"
  ADD CONSTRAINT "photo_task_submissions_reviewed_by_teacher_user_id_fkey"
  FOREIGN KEY ("reviewed_by_teacher_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
