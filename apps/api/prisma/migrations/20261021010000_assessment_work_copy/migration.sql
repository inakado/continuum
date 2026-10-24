ALTER TABLE "assessment_works"
  ADD COLUMN "copied_from_id" UUID,
  ADD COLUMN "copied_from_revision" INTEGER,
  ADD COLUMN "copy_skipped_task_count" INTEGER NOT NULL DEFAULT 0 CHECK ("copy_skipped_task_count" >= 0),
  ADD CONSTRAINT "assessment_works_copy_origin_check" CHECK (
    ("copied_from_id" IS NULL AND "copied_from_revision" IS NULL)
    OR ("copied_from_id" IS NOT NULL AND "copied_from_revision" IS NOT NULL AND "copied_from_revision" > 0)
  );
