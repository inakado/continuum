CREATE TABLE "assessment_solution_answers" (
  "id" UUID NOT NULL,
  "recipient_id" UUID NOT NULL,
  "task_id" UUID NOT NULL,
  "revision" INTEGER NOT NULL DEFAULT 0,
  "locked_at" TIMESTAMP(3),
  CONSTRAINT "assessment_solution_answers_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "assessment_solution_answers_revision_check" CHECK ("revision" >= 0),
  CONSTRAINT "assessment_solution_answers_recipient_id_fkey" FOREIGN KEY ("recipient_id") REFERENCES "assessment_recipients"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "assessment_solution_answers_recipient_id_task_id_key" ON "assessment_solution_answers"("recipient_id", "task_id");
CREATE TABLE "assessment_solution_photos" (
  "id" UUID NOT NULL,
  "answer_id" UUID NOT NULL,
  "object_key" TEXT NOT NULL,
  "content_hash" TEXT NOT NULL,
  "content_type" TEXT NOT NULL,
  "size_bytes" INTEGER NOT NULL,
  "confirmed_at" TIMESTAMP(3),
  "removed_at" TIMESTAMP(3),
  "purged_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "assessment_solution_photos_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "assessment_solution_photos_answer_id_fkey" FOREIGN KEY ("answer_id") REFERENCES "assessment_solution_answers"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "assessment_solution_photos_object_key_key" ON "assessment_solution_photos"("object_key");
CREATE INDEX "assessment_solution_photos_answer_id_created_at_idx" ON "assessment_solution_photos"("answer_id", "created_at");
