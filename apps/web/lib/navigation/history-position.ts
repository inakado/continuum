type Position = { session: string; index: number };
type Traversal = { from: number; to: number; event: PopStateEvent };
const field = '__continuum_position';
type HistoryWindow = Window & { __continuumHistory?: { listeners: Set<(transition: Traversal) => void> } };

export function installHistoryPositions() {
  const runtime = window as HistoryWindow;
  if (runtime.__continuumHistory) return;
  const listeners = new Set<(transition: Traversal) => void>();
  runtime.__continuumHistory = { listeners };
  const session = crypto.randomUUID();
  let current = 0;
  const push = history.pushState.bind(history), replace = history.replaceState.bind(history);
  const state = (data: unknown, index: number) => ({ ...(typeof data === 'object' && data ? data : {}), [field]: { session, index } });
  replace(state(history.state, current), '');
  history.pushState = (data: unknown, unused: string, url?: string | URL | null) => { push(state(data, current + 1), unused, url); current += 1; };
  history.replaceState = (data: unknown, unused: string, url?: string | URL | null) => { replace(state(data, current), unused, url); };
  // Capture runs before Next's popstate listener. Keep all Next state fields intact.
  window.addEventListener('popstate', (event) => {
    const position = (event.state as Record<string, Position> | null)?.[field];
    if (!position || position.session !== session || !Number.isInteger(position.index)) return;
    const from = current;
    current = position.index;
    for (const listener of listeners) listener({ from, to: current, event });
  }, true);
}

export function observeHistoryTraversal(listener: (transition: Traversal) => void) {
  installHistoryPositions();
  const listeners = (window as HistoryWindow).__continuumHistory!.listeners;
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
