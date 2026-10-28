import { Suspense, startTransition, useState } from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import type { AssignmentRevocationPreview } from '@continuum/shared';
import { beforeEach, expect, it, vi } from 'vitest';
import RevokeAssignmentDialog from './RevokeAssignmentDialog';

const state = vi.hoisted(() => ({ data: undefined as AssignmentRevocationPreview | undefined, read: vi.fn(), mutate: vi.fn() }));
vi.mock('./use-assignments', () => ({
  useRevocationPreview: () => { state.read(state.data); return { data: state.data, isPending: !state.data, error: null }; },
  useRevokeAssignment: () => ({ mutate: state.mutate, isPending: false, error: null }),
}));
const id = '00000000-0000-4000-8000-000000000001';
const first = { id, workId: id, versionId: id, title: 'Термодинамика', classTitle: '11Б', academicYear: 2026, studentCount: 20, startedCount: 4, completedCount: 2, recipientsHash: 'a'.repeat(64) };
beforeEach(() => { state.data = undefined; vi.clearAllMocks(); });

it('does not confirm a snapshot captured by a suspended render that never reached the user', async () => {
  const blocked = Promise.withResolvers<void>();
  let update!: (step: number) => void;
  function Gate({ step }: { step: number }) { if (step === 1) throw blocked.promise; return null; }
  function Harness() {
    const [step, setStep] = useState(0); update = setStep;
    return <Suspense fallback={<p>Ожидание</p>}>
      <RevokeAssignmentDialog id={id} close={vi.fn()} onRemoved={vi.fn()} returnFocus={vi.fn()} />
      <Gate step={step} />
    </Suspense>;
  }
  render(<Harness />);
  expect(screen.getByRole('button', { name: 'Убрать назначение' })).toBeDisabled();
  await act(async () => { state.data = first; startTransition(() => update(1)); });
  expect(state.read).toHaveBeenCalledWith(first);
  expect(screen.queryByText(/Учеников: 20/)).not.toBeInTheDocument();

  const committed = { ...first, studentCount: 21, recipientsHash: 'b'.repeat(64) };
  act(() => { state.data = committed; update(2); });
  expect(screen.getByText(/Учеников: 21/)).toBeVisible();
  act(() => { state.data = { ...first, studentCount: 22, recipientsHash: 'c'.repeat(64) }; update(3); });
  expect(screen.getByText(/Учеников: 21/)).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: 'Убрать назначение' }));
  expect(state.mutate).toHaveBeenCalledWith({ id, input: { expectedRecipientsHash: committed.recipientsHash } }, expect.anything());
  await act(async () => blocked.resolve());
});
