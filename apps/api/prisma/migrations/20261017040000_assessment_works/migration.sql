CREATE TABLE "assessment_works" (
  "id" UUID PRIMARY KEY,
  "teacher_id" UUID NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "title" TEXT NOT NULL,
  "instructions" TEXT NOT NULL DEFAULT '',
  "grade_band" "GradeBand" NOT NULL,
  "items" JSONB NOT NULL,
  "revision" INTEGER NOT NULL DEFAULT 1 CHECK ("revision" > 0),
  "task_count" INTEGER NOT NULL DEFAULT 0 CHECK ("task_count" >= 0),
  "max_points" INTEGER NOT NULL DEFAULT 0 CHECK ("max_points" >= 0),
  "last_request_id" UUID,
  "last_input_hash" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL
);
CREATE INDEX "assessment_works_teacher_id_updated_at_idx" ON "assessment_works"("teacher_id", "updated_at");
CREATE TABLE "assessment_work_versions" (
  "id" UUID PRIMARY KEY,
  "work_id" UUID NOT NULL REFERENCES "assessment_works"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "number" INTEGER NOT NULL CHECK ("number" > 0),
  "revision" INTEGER NOT NULL CHECK ("revision" > 0),
  "data" JSONB NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE ("work_id", "number"),
  UNIQUE ("work_id", "revision")
);
