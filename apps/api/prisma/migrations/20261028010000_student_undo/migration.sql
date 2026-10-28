ALTER TABLE "student_profiles" ADD COLUMN "deleted_at" TIMESTAMP(3), ADD COLUMN "lifecycle_revision" INTEGER NOT NULL DEFAULT 1, ADD COLUMN "deleted_was_active" BOOLEAN;
