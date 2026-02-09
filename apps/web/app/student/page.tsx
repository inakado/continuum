import { Suspense } from "react";
import StudentDashboardEntry from "@/features/student-dashboard/StudentDashboardEntry";

export default function StudentDashboardPage() {
  return (
    <Suspense fallback={null}>
      <StudentDashboardEntry />
    </Suspense>
  );
}
