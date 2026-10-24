'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { authApi } from '@/lib/auth/client';
import { clearAnswerDrafts } from '@/lib/assessment/answer-draft';
import { clearReportSearches } from '@/lib/assessment/report-search';

export const useAuthLogout = () => {
  const queryClient = useQueryClient();
  const router = useRouter();

  return async () => {
    try {
      await authApi.signOut();
    } finally {
      clearAnswerDrafts();
      clearReportSearches();
      queryClient.clear();
      router.replace('/login');
    }
  };
};
