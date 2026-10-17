import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { expect, it, vi } from 'vitest';
import RoleGuard from './RoleGuard';

const session = vi.hoisted(() => ({ data: { user: { id: 'first', role: 'student' } } as { user: { id: string; role: string } } | null, isPending: false, isError: false }));
vi.mock('next/navigation', () => ({ usePathname: () => '/student/works/00000000-0000-4000-8000-000000000001', useRouter: () => ({ replace: vi.fn() }) }));
vi.mock('./useAuthSession', () => ({ useAuthSession: () => session }));
function Input() { const [value, setValue] = useState(''); return <input aria-label="Ответ" value={value} onChange={(event) => setValue(event.target.value)} />; }

it('keeps the mounted work and input after expiry, but remounts it for another student', () => {
  session.data = { user: { id: 'first', role: 'student' } };
  const view = render(<RoleGuard requiredRole="student"><Input /></RoleGuard>);
  fireEvent.change(screen.getByRole('textbox'), { target: { value: '7' } });
  session.data = null;
  view.rerender(<RoleGuard requiredRole="student"><Input /></RoleGuard>);
  expect(screen.getByRole('textbox')).toHaveValue('7');
  session.data = { user: { id: 'second', role: 'student' } };
  view.rerender(<RoleGuard requiredRole="student"><Input /></RoleGuard>);
  expect(screen.getByRole('textbox')).toHaveValue('');
});
