-- CreateEnum
CREATE TYPE "StudentUnitStatus" AS ENUM ('locked', 'available', 'in_progress', 'completed');

-- CreateTable
CREATE TABLE "student_unit_state" (
    "student_id" UUID NOT NULL,
    "unit_id" UUID NOT NULL,
    "status" "StudentUnitStatus" NOT NULL,
    "override_opened" BOOLEAN NOT NULL DEFAULT false,
    "counted_tasks" INTEGER NOT NULL DEFAULT 0,
    "solved_tasks" INTEGER NOT NULL DEFAULT 0,
    "total_tasks" INTEGER NOT NULL DEFAULT 0,
    "completion_percent" INTEGER NOT NULL DEFAULT 0,
    "solved_percent" INTEGER NOT NULL DEFAULT 0,
    "became_available_at" TIMESTAMP(3),
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "student_unit_state_pkey" PRIMARY KEY ("student_id","unit_id")
);

-- CreateIndex
CREATE INDEX "student_unit_state_unit_id_status_idx" ON "student_unit_state"("unit_id", "status");

-- CreateIndex
CREATE INDEX "student_unit_state_student_id_status_idx" ON "student_unit_state"("student_id", "status");

-- AddForeignKey
ALTER TABLE "student_unit_state" ADD CONSTRAINT "student_unit_state_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_unit_state" ADD CONSTRAINT "student_unit_state_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "units"("id") ON DELETE CASCADE ON UPDATE CASCADE;
