"use client";

import { useEffect, useRef, useState } from "react";
import { applyTheme, getStoredTheme, persistTheme, type Theme } from "@/lib/theme";

export const useTheme = () => {
  const [theme, setTheme] = useState<Theme>("light");
  const manualRef = useRef<Theme | null>(null);

  useEffect(() => {
    const stored = getStoredTheme();
    if (stored) {
      manualRef.current = stored;
      setTheme(stored);
      applyTheme(stored);
      return;
    }

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const update = () => {
      if (manualRef.current) return;
      const next = media.matches ? "dark" : "light";
      setTheme(next);
      applyTheme(next);
    };

    update();

    if (media.addEventListener) {
      media.addEventListener("change", update);
      return () => media.removeEventListener("change", update);
    }

    media.addListener(update);
    return () => media.removeListener(update);
  }, []);

  const toggle = () => {
    const next: Theme = theme === "dark" ? "light" : "dark";
    manualRef.current = next;
    setTheme(next);
    persistTheme(next);
    applyTheme(next);
  };

  return { theme, toggle };
};
