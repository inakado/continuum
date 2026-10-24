ALTER TABLE "assessment_bank_tasks" ADD COLUMN "deleted_at" TIMESTAMP(3);
CREATE INDEX "assessment_bank_tasks_teacher_id_deleted_at_idx" ON "assessment_bank_tasks"("teacher_id", "deleted_at");
