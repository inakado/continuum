const prefix = 'continuum.report-search:';

export function reportSearchKey(userId: string | undefined, versionId: string) {
  return userId ? `${prefix}${userId}:${versionId}` : null;
}
export function readReportSearch(key: string | null) {
  try { return key ? (sessionStorage.getItem(key) ?? '').slice(0, 200) : ''; }
  catch { return ''; }
}
export function writeReportSearch(key: string | null, value: string) {
  if (!key) return;
  try {
    if (value) sessionStorage.setItem(key, value.slice(0, 200));
    else sessionStorage.removeItem(key);
  } catch { /* Browser storage is optional; current input remains usable. */ }
}
export function clearReportSearches() {
  try {
    for (let index = sessionStorage.length - 1; index >= 0; index--) {
      const key = sessionStorage.key(index);
      if (key?.startsWith(prefix)) sessionStorage.removeItem(key);
    }
  } catch { /* Storage can be unavailable in private or restricted browsers. */ }
}
