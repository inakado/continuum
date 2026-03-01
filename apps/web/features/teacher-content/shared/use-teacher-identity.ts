import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { teacherApi } from "@/lib/api/teacher";
import { contentQueryKeys } from "@/lib/query/keys";

type IdentityState = {
  login: string | null;
  firstName: string | null;
  lastName: string | null;
  middleName: string | null;
};

export const useTeacherIdentity = () => {
  const teacherMeQuery = useQuery({
    queryKey: contentQueryKeys.teacherMe(),
    queryFn: () => teacherApi.getTeacherMe(),
  });

  const state = useMemo<IdentityState>(() => {
    const data = teacherMeQuery.data;
    return {
      login: data?.user?.login ?? null,
      firstName: data?.profile?.firstName ?? null,
      lastName: data?.profile?.lastName ?? null,
      middleName: data?.profile?.middleName ?? null,
    };
  }, [teacherMeQuery.data]);

  const displayName = useMemo(() => {
    const parts = [state.lastName, state.firstName].filter(Boolean);
    if (parts.length > 0) return parts.join(" ");
    return state.login ?? "";
  }, [state.firstName, state.lastName, state.login]);

  return {
    ...state,
    displayName,
  };
};
