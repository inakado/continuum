ALTER TABLE "student_provisioning_batches" ALTER COLUMN "class_id" DROP NOT NULL;
ALTER TABLE "student_provisioning_batches" DROP CONSTRAINT "student_provisioning_batches_class_id_fkey";
ALTER TABLE "student_provisioning_batches" ADD CONSTRAINT "student_provisioning_batches_class_id_fkey"
  FOREIGN KEY ("class_id") REFERENCES "school_classes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
