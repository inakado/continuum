import { buildPageMetadata } from '@/app/page-metadata';
import StatisticsListScreen from '@/features/teacher-statistics/StatisticsListScreen';
import { Suspense } from 'react';
export const metadata = buildPageMetadata('Статистика', 'Результаты работ по заданиям, ученикам и классам.');
export default function Page() { return <Suspense fallback={<p role="status">Загружаем работы…</p>}><StatisticsListScreen /></Suspense>; }
