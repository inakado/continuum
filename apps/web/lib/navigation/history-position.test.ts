import { expect, it, vi } from 'vitest';
import { observeHistoryTraversal } from './history-position';

it('continues the existing history session after a full reload and reports Back/Forward to the save guard', () => {
  const session = crypto.randomUUID();
  history.replaceState({ __NA: true, tree: ['editor'], __continuum_position: { session, index: 2 } }, '', '/teacher/works/editor');
  const listener = vi.fn();
  const stop = observeHistoryTraversal(listener);
  expect(history.state).toMatchObject({ __NA: true, tree: ['editor'], __continuum_position: { session, index: 2 } });
  const back = new PopStateEvent('popstate', { state: { __NA: true, __continuum_position: { session, index: 1 } } });
  window.dispatchEvent(back);
  expect(listener).toHaveBeenLastCalledWith({ from: 2, to: 1, event: back });
  history.pushState({ __NA: true, tree: ['next'] }, '', '/teacher/works/next');
  expect(history.state).toMatchObject({ __NA: true, tree: ['next'], __continuum_position: { session, index: 2 } });
  for (const position of [{ session: 'foreign', index: 0 }, { session, index: -1 }, { session, index: Infinity }, { session, index: '1' }]) {
    window.dispatchEvent(new PopStateEvent('popstate', { state: { __continuum_position: position } }));
  }
  expect(listener).toHaveBeenCalledOnce();
  stop();
});
