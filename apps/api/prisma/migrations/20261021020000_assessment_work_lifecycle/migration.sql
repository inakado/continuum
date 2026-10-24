ALTER TABLE "assessment_works"
  ADD COLUMN "archived_at" TIMESTAMP(3),
  ADD COLUMN "deleted_at" TIMESTAMP(3),
  ADD COLUMN "lifecycle_revision" INTEGER NOT NULL DEFAULT 1 CHECK ("lifecycle_revision" > 0);
