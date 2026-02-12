-- AlterTable
ALTER TABLE "attempts" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "notifications" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "read_at" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "student_task_state" ALTER COLUMN "locked_until" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "credited_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updated_at" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "task_revision_choices" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "task_revision_correct_choices" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "task_revision_numeric_parts" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "task_revisions" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3);
