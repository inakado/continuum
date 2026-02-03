"use client";

import { useEffect } from "react";
import { initializeTheme } from "@/lib/theme";

export default function ThemeHydration() {
  useEffect(() => {
    initializeTheme();
  }, []);

  return null;
}
