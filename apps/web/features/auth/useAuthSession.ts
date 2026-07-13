import { useQuery } from '@tanstack/react-query';
import { authApi } from '@/lib/auth/client';
import { authQueryKeys } from '@/lib/query/keys';

export const useAuthSession = (enabled = true) =>
  useQuery({
    queryKey: authQueryKeys.session(),
    queryFn: authApi.getSession,
    enabled,
    retry: false,
    staleTime: 30_000,
  });
