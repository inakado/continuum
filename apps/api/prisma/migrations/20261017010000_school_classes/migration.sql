CREATE TABLE "school_classes" (
  "id" UUID PRIMARY KEY,
  "teacher_id" UUID NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "title" TEXT NOT NULL,
  "grade" INTEGER NOT NULL CHECK ("grade" BETWEEN 7 AND 11),
  "academic_year" INTEGER NOT NULL CHECK ("academic_year" BETWEEN 2020 AND 2100),
  "is_archived" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  UNIQUE ("teacher_id", "academic_year", "title")
);
CREATE TABLE "student_provisioning_batches" (
  "id" UUID PRIMARY KEY,
  "teacher_id" UUID NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "class_id" UUID NOT NULL REFERENCES "school_classes"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "input_hash" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
ALTER TABLE "student_profiles" ADD COLUMN "middle_name" TEXT,
  ADD COLUMN "class_id" UUID REFERENCES "school_classes"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD COLUMN "provisioning_batch_id" UUID REFERENCES "student_provisioning_batches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "student_profiles_class_id_idx" ON "student_profiles"("class_id");
CREATE TABLE "student_password_resets" (
  "id" UUID PRIMARY KEY,
  "teacher_id" UUID NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "student_id" UUID NOT NULL REFERENCES "student_profiles"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
