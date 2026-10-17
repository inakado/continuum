import { buildPageMetadata } from '@/app/page-metadata';
import TeacherBankScreen from '@/features/teacher-bank/TeacherBankScreen';

export const metadata = buildPageMetadata('Банк заданий', 'Поиск и загрузка заданий для проверочных работ.');
export default function TeacherBankPage() { return <TeacherBankScreen />; }
