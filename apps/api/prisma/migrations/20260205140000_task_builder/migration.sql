-- AlterTable
ALTER TABLE "tasks"
ADD COLUMN "numeric_parts_json" JSONB,
ADD COLUMN "choices_json" JSONB,
ADD COLUMN "correct_answer_json" JSONB,
ADD COLUMN "solution_lite" TEXT;
