import { useEffect, useMemo, useState } from "react";
import { studentApi } from "@/lib/api/student";

type IdentityState = {
  login: string | null;
  firstName: string | null;
  lastName: string | null;
};

export const useStudentIdentity = () => {
  const [state, setState] = useState<IdentityState>({
    login: null,
    firstName: null,
    lastName: null,
  });

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const data = await studentApi.me();
        if (!mounted) return;
        setState({
          login: data.user?.login ?? null,
          firstName: data.profile?.firstName ?? null,
          lastName: data.profile?.lastName ?? null,
        });
      } catch {
        if (!mounted) return;
        setState({ login: null, firstName: null, lastName: null });
      }
    };
    load();
    return () => {
      mounted = false;
    };
  }, []);

  const displayName = useMemo(() => {
    const parts = [state.lastName, state.firstName].filter(Boolean);
    if (parts.length > 0) return parts.join(" ");
    return state.login ?? "";
  }, [state.firstName, state.lastName, state.login]);

  const subtitle = displayName ? `Ученик: ${displayName}` : undefined;

  return { ...state, displayName, subtitle };
};
