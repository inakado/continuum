import { createRef, useState } from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, it, vi } from 'vitest';
import SearchField from './SearchField';

afterEach(cleanup);
it('clears a controlled value from the keyboard and returns focus without submitting a form', async () => {
  const submit = vi.fn((event) => event.preventDefault());
  const user = userEvent.setup();
  function Form() {
    const [value, setValue] = useState('ма');
    return <form onSubmit={submit}><label>Поиск<SearchField label="Поиск задач" value={value} onValueChange={setValue} /></label></form>;
  }
  render(<Form />);
  await user.click(screen.getByRole('searchbox'));
  await user.tab();
  expect(screen.getByRole('button', { name: 'Очистить поиск' })).toHaveFocus();
  await user.keyboard('{Enter}');
  expect(screen.getByRole('searchbox')).toHaveValue('');
  expect(screen.getByRole('searchbox')).toHaveFocus();
  expect(submit).not.toHaveBeenCalled();
  expect(screen.getByRole('button')).toBeDisabled();
  expect(screen.getByRole('button')).toHaveAttribute('data-empty', 'true');
});
it('preserves the supplied DOM ref, input limit and disabled state', async () => {
  const user = userEvent.setup();
  const inputRef = createRef<HTMLInputElement>();
  const change = vi.fn();
  const view = render(<SearchField label="Поиск" inputRef={inputRef} value="" onValueChange={change} placeholder="ФИО" maxLength={200} />);
  expect(inputRef.current).toBe(screen.getByRole('searchbox'));
  expect(inputRef.current).toHaveAttribute('maxlength', '200');
  await user.type(screen.getByRole('searchbox'), 'а');
  expect(change).toHaveBeenCalledWith('а');
  change.mockClear();
  view.rerender(<SearchField label="Поиск" inputRef={inputRef} value="ма" onValueChange={change} disabled />);
  expect(screen.getByRole('searchbox')).toBeDisabled();
  expect(screen.getByRole('button')).toBeDisabled();
  await user.click(screen.getByRole('button'));
  expect(change).not.toHaveBeenCalled();
});
