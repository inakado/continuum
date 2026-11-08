import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import TeacherInteractiveLessonScreen from './TeacherInteractiveLessonScreen';

const mocks = vi.hoisted(() => ({ player: vi.fn(), interactive: vi.fn(), session: vi.fn() }));
vi.mock('@/components/interactive-lesson/InteractiveLessonPlayer', () => ({ default: (props: object) => { mocks.player(props); return <div data-testid="player" />; } }));
vi.mock('@/features/auth/useAuthSession', () => ({ useAuthSession: mocks.session }));
vi.mock('@/features/teacher-shell/TeacherChrome', () => ({ default: () => null }));
vi.mock('./use-teacher-library', () => ({ useTeacherInteractiveArtifact: mocks.interactive }));
const artifact = { artifactId: 'artifact-id', manifest: { lessonId: 'kin-01' }, html: '<html />' };

beforeEach(() => {
  vi.clearAllMocks();
  mocks.session.mockReturnValue({ data: { user: { id: 'teacher-id' } } });
  mocks.interactive.mockReturnValue({ data: artifact });
});

it('opens the requested version with isolated teacher preview state', () => {
  render(<TeacherInteractiveLessonScreen artifactId="artifact-id" />);
  expect(mocks.interactive).toHaveBeenCalledWith('artifact-id', 'teacher-id');
  expect(mocks.player).toHaveBeenCalledWith({ artifact, homeHref: '/teacher/materials', storageScope: 'teacher-id:preview:kin-01' });
});
it('keeps return and retry actions available after a preview error', () => {
  const refetch = vi.fn();
  mocks.interactive.mockReturnValue({ isError: true, refetch });
  render(<TeacherInteractiveLessonScreen artifactId="artifact-id" />);
  expect(screen.getByRole('link', { name: 'К материалам' })).toHaveAttribute('href', '/teacher/materials');
  fireEvent.click(screen.getByRole('button', { name: 'Повторить' }));
  expect(refetch).toHaveBeenCalledOnce();
  expect(mocks.player).not.toHaveBeenCalled();
});
