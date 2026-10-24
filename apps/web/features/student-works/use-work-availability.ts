"use client";
import { useCallback, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ApiError } from '@/lib/api/client';
import { studentWorkQueryKeys } from '@/lib/query/keys';
import { studentWorksApi } from './student-works.api';

export const isWorkUnavailable = (error: Error | null) => error instanceof ApiError && error.status === 404;
export function useWorkAvailability(id: string) {
  const [missing, setMissing] = useState(false);
  const query = useQuery({ queryKey: studentWorkQueryKeys.availability(id), queryFn: () => studentWorksApi.availability(id), enabled: !missing,
    retry: false, staleTime: 0, refetchInterval: (state) => isWorkUnavailable(state.state.error) ? false : 10000,
    refetchOnWindowFocus: 'always', refetchOnReconnect: 'always', refetchIntervalInBackground: false });
  return { unavailable: missing || isWorkUnavailable(query.error), markUnavailable: useCallback(() => setMissing(true), []) };
}
