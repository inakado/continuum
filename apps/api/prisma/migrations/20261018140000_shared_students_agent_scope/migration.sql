ALTER TABLE "reviewer_device_keys"
  ADD COLUMN "classIds" UUID[] NOT NULL DEFAULT ARRAY[]::UUID[],
  ADD COLUMN "studentIds" UUID[] NOT NULL DEFAULT ARRAY[]::UUID[],
  ALTER COLUMN "assignmentIds" SET DEFAULT ARRAY[]::UUID[];

-- Old assignment-scoped credentials must never acquire broader access on upgrade.
UPDATE "api_keys" SET "enabled" = false
WHERE "id" IN (SELECT "id" FROM "reviewer_device_keys");
UPDATE "reviewer_device_keys" SET "revokedAt" = COALESCE("revokedAt", CURRENT_TIMESTAMP);

CREATE UNIQUE INDEX "school_classes_academic_year_title_key" ON "school_classes"("academic_year", "title");
ALTER TABLE "school_classes" DROP CONSTRAINT "school_classes_teacher_id_academic_year_title_key";
