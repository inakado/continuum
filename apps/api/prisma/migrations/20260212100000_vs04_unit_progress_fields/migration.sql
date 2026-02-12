ALTER TABLE "units"
  ADD COLUMN "min_counted_tasks_to_complete" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "units"
  ADD CONSTRAINT "units_min_counted_tasks_to_complete_check"
  CHECK ("min_counted_tasks_to_complete" >= 0);
