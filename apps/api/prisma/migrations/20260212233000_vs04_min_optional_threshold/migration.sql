ALTER TABLE "units"
  RENAME COLUMN "min_counted_tasks_to_complete" TO "min_optional_counted_tasks_to_complete";

UPDATE "units" AS u
SET "min_optional_counted_tasks_to_complete" = GREATEST(
  u."min_optional_counted_tasks_to_complete" - COALESCE(
    (
      SELECT COUNT(*)::INTEGER
      FROM "tasks" AS t
      WHERE t."unit_id" = u."id"
        AND t."is_required" = TRUE
    ),
    0
  ),
  0
);

ALTER TABLE "units"
  DROP CONSTRAINT IF EXISTS "units_min_counted_tasks_to_complete_check";

ALTER TABLE "units"
  DROP CONSTRAINT IF EXISTS "units_min_optional_counted_tasks_to_complete_check";

ALTER TABLE "units"
  ADD CONSTRAINT "units_min_optional_counted_tasks_to_complete_check"
  CHECK ("min_optional_counted_tasks_to_complete" >= 0);
