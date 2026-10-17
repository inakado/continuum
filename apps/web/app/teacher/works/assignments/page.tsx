import { buildPageMetadata } from '@/app/page-metadata';
import AssignmentsListScreen from '@/features/teacher-assignments/AssignmentsListScreen';
export const metadata = buildPageMetadata('Назначения', 'Классы и выполнение назначенных работ.');
export default function Page() { return <AssignmentsListScreen />; }
