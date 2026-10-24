import '@testing-library/jest-dom/vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, expect, it, vi } from 'vitest';
import { reviewerApi } from '@/lib/assessment/reviewer.api';
import { ApiError } from '@/lib/api/client';
import ReviewerAccessScreen from './ReviewerAccessScreen';

vi.mock('@/components/ContinuumHeader', () => ({ default: ({ beforeLogout }: { beforeLogout: () => Promise<boolean> }) => <button onClick={() => void beforeLogout()}>Тестовый выход</button> }));
vi.mock('@/lib/assessment/reviewer.api', () => ({ reviewerApi: { keys: vi.fn(), targets: vi.fn(), createKey: vi.fn(), revokeKey: vi.fn() } }));
const id = '00000000-0000-4000-8000-000000000001';
const pupil = '00000000-0000-4000-8000-000000000002';
const secret = 'cnt_review_test_only_secret';
const entry = { id, name: 'Мой Mac', scopes: ['read', 'draft:write', 'publish'] as const, classIds: [id], studentIds: [pupil], createdAt: '2026-10-18T00:00:00Z', expiresAt: '2026-11-17T00:00:00Z', lastUsedAt: null, revokedAt: null };
const targets = { classes: [{ id, title: '11А', academicYear: 2026, isArchived: false }], students: [{ id: pupil, name: 'Иванов Иван', login: 'ivanov', classId: null }, { id, name: 'Петров Пётр', login: 'petrov', classId: id }] };
afterEach(() => { cleanup(); vi.resetAllMocks(); });
function show(keys: Awaited<ReturnType<typeof reviewerApi.keys>> = []) {
  vi.mocked(reviewerApi.keys).mockResolvedValue(keys);
  vi.mocked(reviewerApi.targets).mockResolvedValue(targets);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const view = render(<QueryClientProvider client={client}><ReviewerAccessScreen /></QueryClientProvider>);
  return { client, ...view };
}
async function openForm() {
  await waitFor(() => expect(screen.getByRole('button', { name: 'Подключить компьютер' })).toBeEnabled());
  fireEvent.click(screen.getByRole('button', { name: 'Подключить компьютер' }));
  fireEvent.change(screen.getByLabelText('Название компьютера'), { target: { value: 'Мой Mac' } });
}
it('connects classes and pupils without storing secrets in caches or browser storage', async () => {
  vi.mocked(reviewerApi.createKey).mockResolvedValue({ key: secret, entry: { ...entry, scopes: [...entry.scopes] } });
  const { client } = show(); await openForm();
  expect(screen.getByRole('heading', { name: 'Подключение агента' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Создать ключ' })).toBeDisabled();
  expect(screen.queryByText('Доступные работы')).not.toBeInTheDocument();
  expect(screen.queryByText('Права проверяющего')).not.toBeInTheDocument();
  expect(screen.queryByText('Совместная проверка')).not.toBeInTheDocument();
  fireEvent.click(screen.getByLabelText(/11А · 2026/));
  fireEvent.click(screen.getByText(/Отдельные ученики/));
  fireEvent.change(screen.getByLabelText('Класс ученика'), { target: { value: 'none' } });
  fireEvent.click(screen.getByLabelText(/Иванов Иван/));
  fireEvent.change(screen.getByLabelText('Ваш пароль'), { target: { value: 'private-password' } });
  fireEvent.click(screen.getByRole('button', { name: 'Создать ключ' }));
  expect(await screen.findByLabelText('Ключ для подключения')).toHaveValue(secret);
  expect(reviewerApi.createKey).toHaveBeenCalledWith({ name: 'Мой Mac', password: 'private-password', classIds: [id], studentIds: [pupil] }, expect.any(AbortSignal));
  expect(screen.queryByLabelText('Ваш пароль')).not.toBeInTheDocument();
  const retained = JSON.stringify(client.getQueryCache().getAll().map((query) => query.state.data));
  expect(retained).not.toContain(secret); expect(retained).not.toContain('private-password');
  expect(client.getMutationCache().getAll()).toHaveLength(0);
  expect(JSON.stringify(localStorage)).not.toContain(secret); expect(JSON.stringify(sessionStorage)).not.toContain(secret);
  fireEvent.click(screen.getByRole('button', { name: 'Готово' }));
  expect(screen.queryByLabelText('Ключ для подключения')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Подключить компьютер' }));
  expect(screen.getByLabelText('Ваш пароль')).toHaveValue('');
});
it('preserves individual pupils across search and class selection, and permits removal', async () => {
  show(); await openForm(); fireEvent.click(screen.getByText(/Отдельные ученики/));
  fireEvent.click(screen.getByLabelText(/Петров Пётр/)); fireEvent.click(screen.getByLabelText(/11А · 2026/));
  expect(screen.getByRole('checkbox', { name: /Петров Пётр/ })).toBeChecked(); expect(screen.getByRole('checkbox', { name: /Петров Пётр/ })).toBeEnabled();
  fireEvent.change(screen.getByLabelText('Поиск ученика'), { target: { value: 'иванов' } });
  expect(screen.getByRole('button', { name: 'Убрать Петров Пётр' })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Убрать Петров Пётр' }));
  expect(screen.queryByRole('button', { name: 'Убрать Петров Пётр' })).not.toBeInTheDocument();
});
it('supports a pupil without a class and displays revoked legacy keys with empty targets', async () => {
  show([{ ...entry, classIds: [], studentIds: [], scopes: [...entry.scopes], revokedAt: '2026-10-18T01:00:00Z' }]);
  await openForm(); expect(screen.getByText('Прежний доступ больше не действует')).toBeInTheDocument();
  fireEvent.click(screen.getByText(/Отдельные ученики/)); fireEvent.click(screen.getByLabelText(/Иванов Иван/));
  expect(screen.getByRole('button', { name: 'Создать ключ' })).toBeEnabled();
});
it('aborts pending issuance on cancellation and never reveals a late secret', async () => {
  let resolve!: (value: Awaited<ReturnType<typeof reviewerApi.createKey>>) => void;
  vi.mocked(reviewerApi.createKey).mockImplementation(() => new Promise((done) => { resolve = done; }));
  show(); await openForm(); fireEvent.click(screen.getByLabelText(/11А · 2026/));
  fireEvent.change(screen.getByLabelText('Ваш пароль'), { target: { value: 'private-password' } });
  fireEvent.click(screen.getByRole('button', { name: 'Создать ключ' })); fireEvent.click(screen.getByRole('button', { name: 'Отмена' }));
  expect(vi.mocked(reviewerApi.createKey).mock.calls[0][1].aborted).toBe(true);
  await act(async () => { resolve({ key: secret, entry: { ...entry, scopes: [...entry.scopes] } }); });
  expect(screen.queryByLabelText('Ключ для подключения')).not.toBeInTheDocument();
});
it('aborts pending issuance on unmount', async () => {
  vi.mocked(reviewerApi.createKey).mockImplementation(() => new Promise(() => {}));
  const view = show(); await openForm(); fireEvent.click(screen.getByLabelText(/11А · 2026/));
  fireEvent.change(screen.getByLabelText('Ваш пароль'), { target: { value: 'private-password' } });
  fireEvent.click(screen.getByRole('button', { name: 'Создать ключ' })); view.unmount();
  expect(vi.mocked(reviewerApi.createKey).mock.calls[0][1].aborted).toBe(true);
});
it('clears the one-time secret before signing out', async () => {
  vi.mocked(reviewerApi.createKey).mockResolvedValue({ key: secret, entry: { ...entry, scopes: [...entry.scopes] } });
  show(); await openForm(); fireEvent.click(screen.getByLabelText(/11А · 2026/));
  fireEvent.change(screen.getByLabelText('Ваш пароль'), { target: { value: 'private-password' } });
  fireEvent.click(screen.getByRole('button', { name: 'Создать ключ' }));
  expect(await screen.findByLabelText('Ключ для подключения')).toHaveValue(secret);
  fireEvent.click(screen.getByRole('button', { name: 'Тестовый выход' }));
  expect(screen.queryByLabelText('Ключ для подключения')).not.toBeInTheDocument();
});
it('clears the password after a failed request without losing chosen targets', async () => {
  vi.mocked(reviewerApi.createKey).mockRejectedValue(new ApiError(400, 'Не удалось создать ключ'));
  show(); await openForm(); fireEvent.click(screen.getByLabelText(/11А · 2026/));
  fireEvent.change(screen.getByLabelText('Ваш пароль'), { target: { value: 'private-password' } });
  fireEvent.click(screen.getByRole('button', { name: 'Создать ключ' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Не удалось создать ключ');
  expect(screen.getByLabelText('Ваш пароль')).toHaveValue('');
  expect(screen.getByLabelText(/11А · 2026/)).toBeChecked();
});

it('requires confirmation to revoke the selected key and retains errors for a safe retry', async () => {
  vi.mocked(reviewerApi.revokeKey).mockRejectedValueOnce(new ApiError(503, 'Нет соединения')).mockResolvedValue({ ok: true });
  show([{ ...entry, scopes: [...entry.scopes] }]);
  fireEvent.click(await screen.findByRole('button', { name: 'Отозвать' }));
  expect(screen.getByRole('alertdialog')).toHaveAccessibleDescription(/Мой Mac.*потеряет доступ/);
  fireEvent.click(screen.getByRole('button', { name: 'Отмена' }));
  expect(reviewerApi.revokeKey).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Отозвать' }));
  fireEvent.click(screen.getByRole('button', { name: 'Отозвать ключ' }));
  await waitFor(() => expect(screen.getByRole('alertdialog')).toHaveTextContent('Нет соединения'));
  fireEvent.click(screen.getByRole('button', { name: 'Отозвать ключ' }));
  await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
  expect(vi.mocked(reviewerApi.revokeKey).mock.calls.map((call) => call[0])).toEqual([id, id]);
});
