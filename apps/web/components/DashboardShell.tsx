"use client";

import StudentDashboardShell, {
  type StudentDashboardShellProps,
} from "@/components/StudentDashboardShell";

/**
 * @deprecated Используйте `StudentDashboardShell` или `TeacherDashboardShell` напрямую.
 */
export type DashboardShellProps = StudentDashboardShellProps;

/**
 * @deprecated Используйте `StudentDashboardShell` или `TeacherDashboardShell` напрямую.
 */
export default function DashboardShell(props: DashboardShellProps) {
  return <StudentDashboardShell {...props} />;
}
