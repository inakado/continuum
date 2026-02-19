import { useEffect, useMemo, useState } from "react";
import { teacherApi } from "@/lib/api/teacher";

type IdentityState = {
  login: string | null;
  firstName: string | null;
  lastName: string | null;
  middleName: string | null;
};

export const useTeacherIdentity = () => {
  const [state, setState] = useState<IdentityState>({
    login: null,
    firstName: null,
    lastName: null,
    middleName: null,
  });

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      try {
        const data = await teacherApi.getTeacherMe();
        if (!mounted) return;
        setState({
          login: data.user?.login ?? null,
          firstName: data.profile?.firstName ?? null,
          lastName: data.profile?.lastName ?? null,
          middleName: data.profile?.middleName ?? null,
        });
      } catch {
        if (!mounted) return;
        setState({
          login: null,
          firstName: null,
          lastName: null,
          middleName: null,
        });
      }
    };

    void load();
    return () => {
      mounted = false;
    };
  }, []);

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
