-- CreateTable
CREATE TABLE "unit_unlock_overrides" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "student_id" UUID NOT NULL,
    "unit_id" UUID NOT NULL,
    "opened_by_teacher_id" UUID NOT NULL,
    "reason" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT "unit_unlock_overrides_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "unit_unlock_overrides_student_id_unit_id_key" ON "unit_unlock_overrides"("student_id", "unit_id");

-- CreateIndex
CREATE INDEX "unit_unlock_overrides_unit_id_idx" ON "unit_unlock_overrides"("unit_id");

-- AddForeignKey
ALTER TABLE "unit_unlock_overrides" ADD CONSTRAINT "unit_unlock_overrides_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "unit_unlock_overrides" ADD CONSTRAINT "unit_unlock_overrides_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "units"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "unit_unlock_overrides" ADD CONSTRAINT "unit_unlock_overrides_opened_by_teacher_id_fkey" FOREIGN KEY ("opened_by_teacher_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
