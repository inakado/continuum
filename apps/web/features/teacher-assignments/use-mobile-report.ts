import { useSyncExternalStore } from 'react';

const query = '(max-width: 760px)';
const subscribe = (listener: () => void) => {
  const media = window.matchMedia(query);
  media.addEventListener('change', listener);
  return () => media.removeEventListener('change', listener);
};
const snapshot = () => window.matchMedia(query).matches;
const serverSnapshot = () => false;

export const useMobileReport = () => useSyncExternalStore(subscribe, snapshot, serverSnapshot);
