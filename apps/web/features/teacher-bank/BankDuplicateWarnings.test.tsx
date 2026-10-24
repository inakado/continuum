import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, it, vi } from 'vitest';
import type { AssessmentDuplicateHints } from '@continuum/shared';
import BankDuplicateWarnings from './BankDuplicateWarnings';
const fixture = vi.hoisted(() => ({ bank: vi.fn(), packaged: vi.fn() }));
vi.mock('./BankTaskPreview', () => ({ default: ({ data }: { data: { statement: string } }) => <p>{data.statement}</p> }));
vi.mock('./use-teacher-bank', () => ({
  useBankImportTask: (id: string, stableId: string) => { fixture.packaged(id, stableId); return { data: { statement: `Из пакета: ${stableId}` }, isPending: false }; },
  useTeacherBankTask: (id: string, version: number) => { fixture.bank(id, version); return { data: { statement: 'Из банка: закреплённое условие' }, isPending: false }; },
}));
const hints: AssessmentDuplicateHints = { status: 'complete', tasks: [{ stableId: 'incoming', hasMore: false, matches: [{ target: { location: 'bank', taskId: '00000000-0000-4000-8000-000000000001', stableId: 'existing', title: 'Похожая задача', version: 3, source: { provider: 'Школково', externalId: '42' } }, reasons: ['source', 'statement'] }] }] };
afterEach(() => { cleanup(); vi.clearAllMocks(); });
it('compares full conditions at pinned versions and restores focus after Escape', async () => {
  const user = userEvent.setup();
  render(<BankDuplicateWarnings previewId="preview" stableId="incoming" hints={hints} loading={false} failed={false} onRetry={vi.fn()} />);
  const trigger = screen.getByRole('button', { name: 'Сравнить' });
  await user.click(trigger);
  expect(screen.getByRole('dialog', { name: 'Сравнение задач' })).toBeVisible();
  expect(screen.getByText('Из пакета: incoming')).toBeVisible();
  expect(screen.getByText('Из банка: закреплённое условие')).toBeVisible();
  expect(fixture.bank).toHaveBeenCalledWith('00000000-0000-4000-8000-000000000001', 3);
  await user.keyboard('{Escape}');
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  expect(trigger).toHaveFocus();
});
it('routes package comparison to preview data and keeps errors advisory', () => {
  const retry = vi.fn();
  const view = render(<BankDuplicateWarnings previewId="preview" stableId="incoming" loading={false} failed onRetry={retry} />);
  expect(screen.getByText(/Это не блокирует импорт/)).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: 'Повторить проверку' })); expect(retry).toHaveBeenCalledOnce();
  const packaged: AssessmentDuplicateHints = { status: 'complete', tasks: [{ stableId: 'incoming', hasMore: true, matches: [{ target: { location: 'package', stableId: 'second', title: 'Из ZIP', version: 1, source: { provider: 'Авторское' } }, reasons: ['statement'] }] }] };
  view.rerender(<BankDuplicateWarnings previewId="preview" stableId="incoming" hints={packaged} loading={false} failed={false} onRetry={retry} />);
  fireEvent.click(screen.getByRole('button', { name: 'Сравнить' }));
  expect(fixture.packaged).toHaveBeenCalledWith('preview', 'second');
  expect(screen.getByText('Из пакета: second')).toBeVisible();
});
