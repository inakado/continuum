import { fireEvent, render, screen } from '@testing-library/react';
import type { AnchorHTMLAttributes } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import StudentInteractiveLessonScreen from './StudentInteractiveLessonScreen';

const mocks = vi.hoisted(() => ({ player: vi.fn(), lesson: vi.fn(), interactive: vi.fn(), session: vi.fn() }));
vi.mock('next/link', () => ({ default: ({ href, children, ...props }: AnchorHTMLAttributes<HTMLAnchorElement>) => <a href={String(href)} {...props}>{children}</a> }));
vi.mock('next/navigation', () => ({ useSearchParams: () => new URLSearchParams('grade=grade_10_11&q=Кинематика') }));
vi.mock('@/components/interactive-lesson/InteractiveLessonPlayer', () => ({ default: (props: object) => { mocks.player(props); return <div data-testid="player" />; } }));
vi.mock('@/features/auth/useAuthSession', () => ({ useAuthSession: mocks.session }));
vi.mock('@/features/student-works/StudentWorksShell', () => ({ StudentChrome: () => null }));
vi.mock('./use-student-library', () => ({ useStudentLesson: mocks.lesson, useStudentInteractiveArtifact: mocks.interactive }));

const artifact = { artifactId: 'artifact-id', manifest: { lessonId: 'kin-01' }, html: '<html />' };
const refetch = vi.fn();
beforeEach(() => {
  vi.clearAllMocks();
  mocks.session.mockReturnValue({ data: { user: { id: 'student-id' } } });
  mocks.lesson.mockReturnValue({ data: { section: { gradeBand: 'grade_10_11' }, artifacts: [{ id: 'artifact-id', type: 'interactive' }] }, isSuccess: true, refetch });
  mocks.interactive.mockReturnValue({ data: artifact, refetch });
});

describe('открытие интерактивной лекции учеником', () => {
  it('requests the published artifact and scopes its state to the current student and lesson', () => {
    render(<StudentInteractiveLessonScreen lessonId="lesson-id" />);
    expect(mocks.interactive).toHaveBeenCalledWith('artifact-id', 'student-id');
    expect(mocks.player).toHaveBeenCalledWith(expect.objectContaining({ artifact, storageScope: 'student-id:lesson-id' }));
    const homeHref = mocks.player.mock.calls[0][0].homeHref as string;
    const url = new URL(homeHref, location.origin);
    expect(url.pathname).toBe('/student/lessons/lesson-id');
    expect(url.searchParams.get('q')).toBe('Кинематика');
  });
  it('shows an unavailable state instead of loading forever when the lesson has no interactive artifact', () => {
    mocks.lesson.mockReturnValue({ data: { section: { gradeBand: 'grade_10_11' }, artifacts: [] }, isSuccess: true, refetch });
    mocks.interactive.mockReturnValue({ refetch });
    render(<StudentInteractiveLessonScreen lessonId="lesson-id" />);
    expect(screen.getByRole('alert')).toHaveTextContent('недоступна');
    expect(mocks.player).not.toHaveBeenCalled();
  });
  it('does not mount the player with another account or without a resolved session', () => {
    mocks.session.mockReturnValue({ isPending: true });
    render(<StudentInteractiveLessonScreen lessonId="lesson-id" />);
    expect(mocks.player).not.toHaveBeenCalled();
    expect(screen.getByRole('status')).toHaveTextContent('Загружаем');
  });
  it('allows retry after a protected document read fails', () => {
    mocks.interactive.mockReturnValue({ isError: true, refetch });
    render(<StudentInteractiveLessonScreen lessonId="lesson-id" />);
    fireEvent.click(screen.getByRole('button', { name: 'Повторить' }));
    expect(refetch).toHaveBeenCalledTimes(2);
    expect(mocks.player).not.toHaveBeenCalled();
  });
});
