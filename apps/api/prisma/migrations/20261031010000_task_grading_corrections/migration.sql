ALTER TABLE "assessment_task_versions" ADD COLUMN "grading_source_version" INTEGER;
ALTER TABLE "assessment_task_versions" ADD CONSTRAINT "assessment_grading_source_valid" CHECK ("grading_source_version" IS NULL OR ("is_presentation_correction" AND "grading_source_version" > 0 AND "grading_source_version" < "version"));
