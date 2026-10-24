type Position = { session: string; index: number };
type Traversal = { from: number; to: number; event: PopStateEvent };
const field = '__continuum_position';
type HistoryWindow = Window & { __continuumHistory?: { listeners: Set<(transition: Traversal) => void> } };
function readPosition(data: unknown): Position | null {
  if (!data || typeof data !== 'object' || !(field in data)) return null;
  const position = data[field];
  if (!position || typeof position !== 'object' || !('session' in position) || !('index' in position)) return null;
  return typeof position.session === 'string' && position.session.length > 0 && typeof position.index === 'number' && Number.isSafeInteger(position.index) && position.index >= 0
    ? { session: position.session, index: position.index } : null;
}

export function installHistoryPositions() {
  const runtime = window as HistoryWindow;
  if (runtime.__continuumHistory) return;
  const listeners = new Set<(transition: Traversal) => void>();
  runtime.__continuumHistory = { listeners };
  const previous = readPosition(history.state);
  const session = previous?.session ?? crypto.randomUUID();
  let current = previous?.index ?? 0;
  const push = history.pushState.bind(history), replace = history.replaceState.bind(history);
  const state = (data: unknown, index: number) => ({ ...(typeof data === 'object' && data ? data : {}), [field]: { session, index } });
  replace(state(history.state, current), '');
  history.pushState = (data: unknown, unused: string, url?: string | URL | null) => { push(state(data, current + 1), unused, url); current += 1; };
  history.replaceState = (data: unknown, unused: string, url?: string | URL | null) => { replace(state(data, current), unused, url); };
  // Capture runs before Next's popstate listener. Keep all Next state fields intact.
  window.addEventListener('popstate', (event) => {
    const position = readPosition(event.state);
    if (!position || position.session !== session) return;
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
