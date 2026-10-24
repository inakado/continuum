ALTER TABLE "assessment_assignment_requests" ADD COLUMN "invalidated_at" TIMESTAMP(3);
CREATE TABLE "assessment_assignment_revocations" (
  "id" UUID NOT NULL,
  "teacher_id" UUID NOT NULL,
  "work_id" UUID NOT NULL,
  "version_id" UUID NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "assessment_assignment_revocations_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "assessment_assignment_revocations_teacher_id_idx" ON "assessment_assignment_revocations"("teacher_id");
CREATE TABLE "assessment_file_deletions" (
  "object_key" TEXT NOT NULL,
  "retry_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "assessment_file_deletions_pkey" PRIMARY KEY ("object_key")
);
CREATE INDEX "assessment_file_deletions_retry_at_idx" ON "assessment_file_deletions"("retry_at");
