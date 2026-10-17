CREATE TABLE "assessment_assignments" (
  "id" UUID PRIMARY KEY,
  "version_id" UUID NOT NULL REFERENCES "assessment_work_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "class_id" UUID REFERENCES "school_classes"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  "class_title" TEXT NOT NULL,
  "academic_year" INTEGER NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE ("version_id", "class_id")
);
CREATE TABLE "assessment_recipients" (
  "id" UUID PRIMARY KEY,
  "assignment_id" UUID NOT NULL REFERENCES "assessment_assignments"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "version_id" UUID NOT NULL REFERENCES "assessment_work_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "student_id" UUID REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  "student_name" TEXT NOT NULL,
  "student_login" TEXT NOT NULL,
  "answers" JSONB NOT NULL DEFAULT '{}',
  "revision" INTEGER NOT NULL DEFAULT 1 CHECK ("revision" > 0),
  "answered_count" INTEGER NOT NULL DEFAULT 0 CHECK ("answered_count" >= 0),
  "started_at" TIMESTAMP(3),
  "completed_at" TIMESTAMP(3),
  "points" INTEGER CHECK ("points" >= 0),
  "correct_count" INTEGER CHECK ("correct_count" >= 0),
  "incorrect_count" INTEGER CHECK ("incorrect_count" >= 0),
  "last_request_id" UUID,
  "last_input_hash" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CHECK (("completed_at" IS NULL AND "points" IS NULL AND "correct_count" IS NULL AND "incorrect_count" IS NULL)
    OR ("completed_at" IS NOT NULL AND "started_at" IS NOT NULL AND "points" IS NOT NULL AND "correct_count" IS NOT NULL AND "incorrect_count" IS NOT NULL)),
  UNIQUE ("version_id", "student_id")
);
CREATE INDEX "assessment_recipients_student_id_created_at_idx" ON "assessment_recipients"("student_id", "created_at");
CREATE INDEX "assessment_recipients_assignment_id_idx" ON "assessment_recipients"("assignment_id");
CREATE TABLE "assessment_assignment_requests" (
  "id" UUID PRIMARY KEY,
  "work_id" UUID NOT NULL REFERENCES "assessment_works"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "input_hash" TEXT NOT NULL,
  "result" JSONB NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "assessment_assignment_requests_work_id_idx" ON "assessment_assignment_requests"("work_id");
