-- CreateEnum
CREATE TYPE "TaskAnswerType" AS ENUM ('numeric', 'single_choice', 'multi_choice', 'photo');
CREATE TYPE "StudentTaskStatus" AS ENUM (
  'not_started',
  'in_progress',
  'correct',
  'pending_review',
  'rejected',
  'blocked',
  'credited_without_progress',
  'teacher_credited'
);
CREATE TYPE "AttemptKind" AS ENUM ('numeric', 'single_choice', 'multi_choice', 'photo');
CREATE TYPE "AttemptResult" AS ENUM ('correct', 'incorrect', 'pending_review', 'accepted', 'rejected');
CREATE TYPE "NotificationType" AS ENUM ('photo_reviewed', 'unit_override_opened', 'required_task_skipped', 'task_locked');

-- AlterTable
ALTER TABLE "courses" ADD COLUMN "lock_duration_minutes" INTEGER NOT NULL DEFAULT 30;

-- Task revisions
CREATE TABLE "task_revisions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "task_id" UUID NOT NULL,
    "revision_no" INTEGER NOT NULL,
    "answer_type" "TaskAnswerType" NOT NULL,
    "statement_lite" TEXT NOT NULL,
    "solution_lite" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT "task_revisions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "task_revisions_task_id_revision_no_key" ON "task_revisions"("task_id", "revision_no");
CREATE INDEX "task_revisions_task_id_created_at_idx" ON "task_revisions"("task_id", "created_at");

CREATE TABLE "task_revision_numeric_parts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "task_revision_id" UUID NOT NULL,
    "part_key" TEXT NOT NULL,
    "label_lite" TEXT,
    "correct_value" TEXT NOT NULL,

    CONSTRAINT "task_revision_numeric_parts_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "task_revision_numeric_parts_task_revision_id_part_key_key" ON "task_revision_numeric_parts"("task_revision_id", "part_key");
CREATE INDEX "task_revision_numeric_parts_task_revision_id_idx" ON "task_revision_numeric_parts"("task_revision_id");

CREATE TABLE "task_revision_choices" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "task_revision_id" UUID NOT NULL,
    "choice_key" TEXT NOT NULL,
    "content_lite" TEXT NOT NULL,

    CONSTRAINT "task_revision_choices_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "task_revision_choices_task_revision_id_choice_key_key" ON "task_revision_choices"("task_revision_id", "choice_key");
CREATE INDEX "task_revision_choices_task_revision_id_idx" ON "task_revision_choices"("task_revision_id");

CREATE TABLE "task_revision_correct_choices" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "task_revision_id" UUID NOT NULL,
    "choice_key" TEXT NOT NULL,

    CONSTRAINT "task_revision_correct_choices_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "task_revision_correct_choices_task_revision_id_choice_key_key" ON "task_revision_correct_choices"("task_revision_id", "choice_key");
CREATE INDEX "task_revision_correct_choices_task_revision_id_idx" ON "task_revision_correct_choices"("task_revision_id");

-- Add active revision to tasks (nullable for backfill)
ALTER TABLE "tasks" ADD COLUMN "active_revision_id" UUID;

-- Backfill revisions from existing tasks
WITH inserted AS (
  INSERT INTO "task_revisions" ("id", "task_id", "revision_no", "answer_type", "statement_lite", "solution_lite", "created_at")
  SELECT gen_random_uuid(), "id", 1, "answer_type"::"TaskAnswerType", "statement_lite", "solution_lite", "created_at"
  FROM "tasks"
  RETURNING "id", "task_id"
)
UPDATE "tasks" t
SET "active_revision_id" = i."id"
FROM inserted i
WHERE t."id" = i."task_id";

INSERT INTO "task_revision_numeric_parts" ("id", "task_revision_id", "part_key", "label_lite", "correct_value")
SELECT gen_random_uuid(), r."id", part->>'key', part->>'labelLite', part->>'correctValue'
FROM "task_revisions" r
JOIN "tasks" t ON t."id" = r."task_id"
CROSS JOIN LATERAL jsonb_array_elements(t."numeric_parts_json") part
WHERE t."numeric_parts_json" IS NOT NULL
  AND jsonb_typeof(t."numeric_parts_json") = 'array';

INSERT INTO "task_revision_choices" ("id", "task_revision_id", "choice_key", "content_lite")
SELECT gen_random_uuid(), r."id", choice->>'key', choice->>'textLite'
FROM "task_revisions" r
JOIN "tasks" t ON t."id" = r."task_id"
CROSS JOIN LATERAL jsonb_array_elements(t."choices_json") choice
WHERE t."choices_json" IS NOT NULL
  AND jsonb_typeof(t."choices_json") = 'array';

INSERT INTO "task_revision_correct_choices" ("id", "task_revision_id", "choice_key")
SELECT gen_random_uuid(), r."id", t."correct_answer_json"->>'key'
FROM "task_revisions" r
JOIN "tasks" t ON t."id" = r."task_id"
WHERE t."correct_answer_json" ? 'key';

INSERT INTO "task_revision_correct_choices" ("id", "task_revision_id", "choice_key")
SELECT gen_random_uuid(), r."id", jsonb_array_elements_text(t."correct_answer_json"->'keys')
FROM "task_revisions" r
JOIN "tasks" t ON t."id" = r."task_id"
WHERE t."correct_answer_json" ? 'keys';

ALTER TABLE "tasks" ADD CONSTRAINT "tasks_active_revision_id_fkey"
  FOREIGN KEY ("active_revision_id") REFERENCES "task_revisions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Add FKs for revisions
ALTER TABLE "task_revisions" ADD CONSTRAINT "task_revisions_task_id_fkey"
  FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "task_revision_numeric_parts" ADD CONSTRAINT "task_revision_numeric_parts_task_revision_id_fkey"
  FOREIGN KEY ("task_revision_id") REFERENCES "task_revisions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "task_revision_choices" ADD CONSTRAINT "task_revision_choices_task_revision_id_fkey"
  FOREIGN KEY ("task_revision_id") REFERENCES "task_revisions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "task_revision_correct_choices" ADD CONSTRAINT "task_revision_correct_choices_task_revision_id_fkey"
  FOREIGN KEY ("task_revision_id") REFERENCES "task_revisions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Remove legacy task fields
ALTER TABLE "tasks"
  DROP COLUMN "statement_lite",
  DROP COLUMN "answer_type",
  DROP COLUMN "numeric_parts_json",
  DROP COLUMN "choices_json",
  DROP COLUMN "correct_answer_json",
  DROP COLUMN "solution_lite";

-- Learning state
CREATE TABLE "student_task_state" (
    "student_id" UUID NOT NULL,
    "task_id" UUID NOT NULL,
    "status" "StudentTaskStatus" NOT NULL,
    "active_revision_id" UUID NOT NULL,
    "wrong_attempts" INTEGER NOT NULL DEFAULT 0,
    "locked_until" TIMESTAMPTZ,
    "required_skipped" BOOLEAN NOT NULL DEFAULT false,
    "credited_revision_id" UUID,
    "credited_at" TIMESTAMPTZ,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "student_task_state_pkey" PRIMARY KEY ("student_id", "task_id")
);

CREATE INDEX "student_task_state_student_id_status_idx" ON "student_task_state"("student_id", "status");
CREATE INDEX "student_task_state_task_id_status_idx" ON "student_task_state"("task_id", "status");
CREATE INDEX "student_task_state_locked_until_idx" ON "student_task_state"("locked_until");

ALTER TABLE "student_task_state" ADD CONSTRAINT "student_task_state_student_id_fkey"
  FOREIGN KEY ("student_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "student_task_state" ADD CONSTRAINT "student_task_state_task_id_fkey"
  FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "student_task_state" ADD CONSTRAINT "student_task_state_active_revision_id_fkey"
  FOREIGN KEY ("active_revision_id") REFERENCES "task_revisions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "student_task_state" ADD CONSTRAINT "student_task_state_credited_revision_id_fkey"
  FOREIGN KEY ("credited_revision_id") REFERENCES "task_revisions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "attempts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "student_id" UUID NOT NULL,
    "task_id" UUID NOT NULL,
    "task_revision_id" UUID NOT NULL,
    "attempt_no" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
    "kind" "AttemptKind" NOT NULL,
    "numeric_answers" JSONB,
    "selected_choice_key" TEXT,
    "selected_choice_keys" JSONB,
    "result" "AttemptResult" NOT NULL,

    CONSTRAINT "attempts_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "attempts_student_id_task_revision_id_attempt_no_key" ON "attempts"("student_id", "task_revision_id", "attempt_no");
CREATE INDEX "attempts_student_id_created_at_idx" ON "attempts"("student_id", "created_at");
CREATE INDEX "attempts_task_id_created_at_idx" ON "attempts"("task_id", "created_at");
CREATE INDEX "attempts_task_revision_id_created_at_idx" ON "attempts"("task_revision_id", "created_at");

ALTER TABLE "attempts" ADD CONSTRAINT "attempts_student_id_fkey"
  FOREIGN KEY ("student_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "attempts" ADD CONSTRAINT "attempts_task_id_fkey"
  FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "attempts" ADD CONSTRAINT "attempts_task_revision_id_fkey"
  FOREIGN KEY ("task_revision_id") REFERENCES "task_revisions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "notifications" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "recipient_user_id" UUID NOT NULL,
    "type" "NotificationType" NOT NULL,
    "payload" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
    "read_at" TIMESTAMPTZ,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "notifications_recipient_user_id_read_at_created_at_idx" ON "notifications"("recipient_user_id", "read_at", "created_at");

ALTER TABLE "notifications" ADD CONSTRAINT "notifications_recipient_user_id_fkey"
  FOREIGN KEY ("recipient_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
