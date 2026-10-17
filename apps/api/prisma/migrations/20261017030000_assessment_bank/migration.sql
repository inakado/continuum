CREATE TABLE "assessment_bank_tasks" (
  "id" UUID PRIMARY KEY,
  "teacher_id" UUID NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "stable_id" TEXT NOT NULL,
  "latest_version_id" UUID UNIQUE,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE ("teacher_id", "stable_id")
);
CREATE TABLE "assessment_task_versions" (
  "id" UUID PRIMARY KEY,
  "task_id" UUID NOT NULL REFERENCES "assessment_bank_tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "version" INTEGER NOT NULL CHECK ("version" > 0),
  "content_hash" TEXT NOT NULL,
  "data" JSONB NOT NULL,
  "title" TEXT NOT NULL,
  "grade_band" "GradeBand" NOT NULL,
  "type" TEXT NOT NULL,
  "topic_path" TEXT[] NOT NULL,
  "search_text" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE ("task_id", "version")
);
ALTER TABLE "assessment_bank_tasks" ADD CONSTRAINT "assessment_bank_tasks_latest_version_id_fkey"
  FOREIGN KEY ("latest_version_id") REFERENCES "assessment_task_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "assessment_task_versions_grade_band_type_idx" ON "assessment_task_versions"("grade_band", "type");
CREATE TABLE "assessment_bank_imports" (
  "id" UUID PRIMARY KEY,
  "teacher_id" UUID NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "title" TEXT NOT NULL,
  "data" JSONB NOT NULL,
  "baseline" JSONB NOT NULL,
  "result" JSONB,
  "expires_at" TIMESTAMP(3) NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "assessment_bank_imports_teacher_id_expires_at_idx" ON "assessment_bank_imports"("teacher_id", "expires_at");
