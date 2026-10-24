import { buildPageMetadata } from '@/app/page-metadata';
import TeacherWorksScreen from '@/features/teacher-works/TeacherWorksScreen';
import { Suspense } from 'react';
export const metadata = buildPageMetadata('Работы', 'Создание проверочных работ из банка заданий.');
export default function TeacherWorksPage() { return <Suspense fallback={<p role="status">Загружаем работы…</p>}><TeacherWorksScreen /></Suspense>; }
