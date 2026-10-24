"use client";
import { useQuery } from '@tanstack/react-query';
import { AssessmentStatisticsSchema, StatisticsTaskDetailSchema } from '@continuum/shared';
import { apiRequestParsed } from '@/lib/api/client';
import { statisticsQueryKeys } from '@/lib/query/keys';

const root = '/teacher/assessment-statistics';
export const useStatistics = (id: string) => useQuery({ queryKey: statisticsQueryKeys.report(id), queryFn: () => apiRequestParsed(`${root}/${id}`, AssessmentStatisticsSchema), refetchInterval: 15000, refetchIntervalInBackground: false });
export const useStatisticsDetail = (id: string, task: string, recipient?: string) => useQuery({ queryKey: statisticsQueryKeys.detail(id, task, recipient), queryFn: () => apiRequestParsed(`${root}/${id}/items/${task}${recipient ? `?recipient=${recipient}` : ''}`, StatisticsTaskDetailSchema), gcTime: 0, refetchInterval: recipient ? 15000 : false, refetchIntervalInBackground: false });
