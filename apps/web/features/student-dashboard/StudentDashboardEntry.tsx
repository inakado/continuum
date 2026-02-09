"use client";

import { useSearchParams } from "next/navigation";
import StudentDashboardScreen from "./StudentDashboardScreen";
import { COURSES_QUERY_KEY, COURSES_QUERY_VALUE } from "./constants";

export default function StudentDashboardEntry() {
  const searchParams = useSearchParams();
  const queryOverride = searchParams.get(COURSES_QUERY_KEY) === COURSES_QUERY_VALUE;

  return <StudentDashboardScreen queryOverride={queryOverride} />;
}
