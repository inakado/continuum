import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { expect, it, vi } from 'vitest';
import type { InteractiveLessonDocument } from '@continuum/shared';
import InteractiveLessonPlayer from './InteractiveLessonPlayer';

vi.mock('@/components/ContinuumHeader', () => ({ default: ({ subject }: { subject: ReactNode }) => <header>{subject}</header> }));
const artifact: InteractiveLessonDocument = {
  artifactId: '00000000-0000-4000-a000-000000000001',
  manifest: { schemaVersion: 1, lessonId: 'kin-01', title: 'Кинематика', entrypoint: 'lesson.html', contentSha256: 'a'.repeat(64), sections: [{ id: 'intro', title: 'Начало' }], questions: [] },
  html: '<main id="package-marker"><script>window.packageHasRun=true</script></main>',
};

it('mounts imported markup only in an opaque sandbox and places the host CSP before it', () => {
  render(<InteractiveLessonPlayer artifact={artifact} homeHref="/student" storageScope="alice:lesson" />);
  const frame = screen.getByTitle('Кинематика');
  expect(frame).toHaveAttribute('sandbox', 'allow-scripts');
  expect(frame).not.toHaveAttribute('src');
  expect(frame).toHaveAttribute('referrerpolicy', 'no-referrer');
  expect(frame.getAttribute('allow')).toContain("camera 'none'");
  expect(document.getElementById('package-marker')).toBeNull();
  const html = frame.getAttribute('srcdoc')!;
  expect(html.indexOf("connect-src 'none'")).toBeLessThan(html.indexOf(artifact.html));
  expect(html).toContain(artifact.html);
  expect(screen.getByRole('button', { name: 'Разделы занятия' })).toBeDisabled();
});
