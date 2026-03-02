import type { useSearchParams } from "next/navigation";
import type * as TeacherApiModule from "@/lib/api/teacher";

export type ProfileContext = {
  courseId?: string | null;
  sectionId?: string | null;
  taskId?: string | null;
  unitId?: string | null;
};

export type TeacherStudentProfileDetails = NonNullable<
  ReturnType<typeof TeacherApiModule.teacherApi.getStudentProfile> extends Promise<infer TValue>
    ? TValue
    : never
>;

export type TeacherStudentProfileCourseTree = NonNullable<TeacherStudentProfileDetails["courseTree"]>;

export type TeacherStudentProfileSection = TeacherStudentProfileCourseTree["sections"][number];

export const getDisplayName = (
  firstName?: string | null,
  lastName?: string | null,
  login?: string | null,
  fallback?: string,
) => {
  const parts = [lastName?.trim(), firstName?.trim()].filter(Boolean);
  if (parts.length) return parts.join(" ");
  return login ?? fallback ?? "Ученик";
};

export const getFocusedContextFromSearchParams = (searchParams: ReturnType<typeof useSearchParams>) => ({
  courseId: searchParams.get("courseId")?.trim() || null,
  sectionId: searchParams.get("sectionId")?.trim() || null,
  unitId: searchParams.get("unitId")?.trim() || null,
  taskId: searchParams.get("taskId")?.trim() || null,
});

export const getProfileStage = (
  activeCourseId: string | null,
  selectedSectionId: string | null,
  selectedUnitId: string | null,
): "courses" | "sections" | "units" | "tasks" => {
  if (!activeCourseId) return "courses";
  if (!selectedSectionId) return "sections";
  if (!selectedUnitId) return "units";
  return "tasks";
};
