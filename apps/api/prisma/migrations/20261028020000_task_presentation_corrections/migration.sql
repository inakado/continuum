ALTER TABLE "assessment_task_versions" ADD COLUMN "is_presentation_correction" BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX "assessment_task_presentation_idx" ON "assessment_task_versions"("task_id", "is_presentation_correction", "version");
