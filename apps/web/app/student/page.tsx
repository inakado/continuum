import { Suspense } from "react";
import { buildPageMetadata } from "@/app/page-metadata";
import StudentDashboardEntry from "@/features/student-dashboard/StudentDashboardEntry";

export const metadata = buildPageMetadata("Мои курсы", "Главный student dashboard с курсами и текущим прогрессом.");

export default function StudentDashboardPage() {
  return (
    <Suspense fallback={null}>
      <StudentDashboardEntry />
    </Suspense>
  );
}
