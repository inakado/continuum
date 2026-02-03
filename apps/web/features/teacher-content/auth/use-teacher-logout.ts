"use client";

import { useRouter } from "next/navigation";
import { teacherApi } from "@/lib/api/teacher";

export const useTeacherLogout = () => {
  const router = useRouter();

  return async () => {
    try {
      await teacherApi.logout();
    } finally {
      router.push("/login");
    }
  };
};
