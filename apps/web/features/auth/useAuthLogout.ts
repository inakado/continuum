'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { authApi } from '@/lib/auth/client';

export const useAuthLogout = () => {
  const queryClient = useQueryClient();
  const router = useRouter();

  return async () => {
    try {
      await authApi.signOut();
    } finally {
      queryClient.clear();
      router.replace('/login');
    }
  };
};
