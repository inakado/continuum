import { useSyncExternalStore } from 'react';

const query = '(max-width: 760px)';
const subscribe = (listener: () => void) => {
  const media = window.matchMedia(query);
  media.addEventListener('change', listener);
  return () => media.removeEventListener('change', listener);
};
export const useStudentMobile = () => useSyncExternalStore(subscribe, () => window.matchMedia(query).matches, () => false);
