export type Theme = "light" | "dark";

const STORAGE_KEY = "continuum-theme";

export const getStoredTheme = (): Theme | null => {
  if (typeof window === "undefined") return null;
  const value = window.localStorage.getItem(STORAGE_KEY);
  return value === "light" || value === "dark" ? value : null;
};

export const getPreferredTheme = (): Theme => {
  if (typeof window === "undefined") return "light";
  const media = window.matchMedia("(prefers-color-scheme: dark)");
  return media.matches ? "dark" : "light";
};

export const applyTheme = (theme: Theme) => {
  if (typeof document === "undefined") return;
  document.documentElement.dataset.theme = theme;
};

export const initializeTheme = () => {
  const stored = getStoredTheme();
  const next = stored ?? getPreferredTheme();
  applyTheme(next);
  return next;
};

export const persistTheme = (theme: Theme) => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, theme);
};
