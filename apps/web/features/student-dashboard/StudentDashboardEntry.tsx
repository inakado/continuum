"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import StudentDashboardScreen from "./StudentDashboardScreen";
import { COURSES_QUERY_KEY, COURSES_QUERY_VALUE } from "./constants";

function StudentDashboardEntryContent() {
  const searchParams = useSearchParams();
  const queryOverride = searchParams.get(COURSES_QUERY_KEY) === COURSES_QUERY_VALUE;

  return <StudentDashboardScreen queryOverride={queryOverride} />;
}

export default function StudentDashboardEntry() {
  return (
    <Suspense fallback={null}>
      <StudentDashboardEntryContent />
    </Suspense>
  );
}
