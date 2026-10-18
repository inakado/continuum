import { buildPageMetadata } from '@/app/page-metadata';
import ReviewerAccessScreen from '@/features/teacher-reviewer/ReviewerAccessScreen';
export const metadata = buildPageMetadata('Подключение агента', 'Компьютеры и доступ агента к выбранным классам и ученикам.');
export default function ReviewerAccessPage() { return <ReviewerAccessScreen />; }
