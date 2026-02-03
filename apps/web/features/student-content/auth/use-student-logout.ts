"use client";

import { useRouter } from "next/navigation";
import { studentApi } from "@/lib/api/student";

export const useStudentLogout = () => {
  const router = useRouter();

  return async () => {
    try {
      await studentApi.logout();
    } finally {
      router.push("/login");
    }
  };
};
