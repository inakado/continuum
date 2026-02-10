-- CreateTable
CREATE TABLE "student_profile" (
    "user_id" UUID NOT NULL,
    "lead_teacher_id" UUID NOT NULL,
    "display_name" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "student_profile_pkey" PRIMARY KEY ("user_id")
);

-- CreateIndex
CREATE INDEX "student_profile_lead_teacher_id_idx" ON "student_profile"("lead_teacher_id");

-- AddForeignKey
ALTER TABLE "student_profile" ADD CONSTRAINT "student_profile_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_profile" ADD CONSTRAINT "student_profile_lead_teacher_id_fkey" FOREIGN KEY ("lead_teacher_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
