import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { studentApi } from "@/lib/api/student";
import { contentQueryKeys } from "@/lib/query/keys";

type IdentityState = {
  login: string | null;
  firstName: string | null;
  lastName: string | null;
};

export const useStudentIdentity = () => {
  const studentMeQuery = useQuery({
    queryKey: contentQueryKeys.studentMe(),
    queryFn: studentApi.me,
  });
  const state = useMemo<IdentityState>(() => ({
    login: studentMeQuery.data?.user.login ?? null,
    firstName: studentMeQuery.data?.profile?.firstName ?? null,
    lastName: studentMeQuery.data?.profile?.lastName ?? null,
  }), [studentMeQuery.data]);

  const displayName = useMemo(() => {
    const parts = [state.lastName, state.firstName].filter(Boolean);
    if (parts.length > 0) return parts.join(" ");
    return state.login ?? "";
  }, [state.firstName, state.lastName, state.login]);

  const subtitle = displayName ? `Ученик: ${displayName}` : undefined;

  return { ...state, displayName, subtitle };
};
