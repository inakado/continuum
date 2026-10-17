import { buildPageMetadata } from '@/app/page-metadata';
import StudentWorksScreen from '@/features/student-works/StudentWorksScreen';
export const metadata = buildPageMetadata('Работы', 'Назначенные проверочные работы.');
export default function Page() { return <StudentWorksScreen />; }
