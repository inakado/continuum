import { buildPageMetadata } from '@/app/page-metadata';
import TeacherBankScreen from '@/features/teacher-bank/TeacherBankScreen';
import { Suspense } from 'react';

export const metadata = buildPageMetadata('Банк заданий', 'Поиск и загрузка заданий для проверочных работ.');
export default function TeacherBankPage() { return <Suspense fallback={<p role="status">Загружаем банк заданий…</p>}><TeacherBankScreen /></Suspense>; }
