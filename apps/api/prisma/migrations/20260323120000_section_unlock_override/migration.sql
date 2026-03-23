CREATE TABLE "section_unlock_overrides" (
    "id" UUID NOT NULL,
    "student_id" UUID NOT NULL,
    "section_id" UUID NOT NULL,
    "opened_by_teacher_id" UUID NOT NULL,
    "reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "section_unlock_overrides_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "section_unlock_overrides_student_id_section_id_key"
ON "section_unlock_overrides"("student_id", "section_id");

CREATE INDEX "section_unlock_overrides_section_id_idx"
ON "section_unlock_overrides"("section_id");

ALTER TABLE "section_unlock_overrides"
ADD CONSTRAINT "section_unlock_overrides_student_id_fkey"
FOREIGN KEY ("student_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "section_unlock_overrides"
ADD CONSTRAINT "section_unlock_overrides_section_id_fkey"
FOREIGN KEY ("section_id") REFERENCES "sections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "section_unlock_overrides"
ADD CONSTRAINT "section_unlock_overrides_opened_by_teacher_id_fkey"
FOREIGN KEY ("opened_by_teacher_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
