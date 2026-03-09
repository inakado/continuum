"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Params = {
  isDirty: boolean;
  confirmMessage?: string;
};

export default function useUnsavedChangesGuard({
  isDirty,
  confirmMessage = "Есть несохранённые изменения. Если вы уйдёте со страницы, они будут потеряны.",
}: Params) {
  const pendingNavigationRef = useRef<(() => void) | null>(null);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);

  const requestNavigation = useCallback(
    (navigate: () => void) => {
      if (!isDirty) {
        navigate();
        return;
      }

      pendingNavigationRef.current = navigate;
      setIsConfirmOpen(true);
    },
    [isDirty],
  );

  const cancelNavigation = useCallback(() => {
    pendingNavigationRef.current = null;
    setIsConfirmOpen(false);
  }, []);

  const confirmNavigation = useCallback(() => {
    const navigate = pendingNavigationRef.current;
    pendingNavigationRef.current = null;
    setIsConfirmOpen(false);
    navigate?.();
  }, []);

  useEffect(() => {
    if (isDirty) {
      return;
    }

    pendingNavigationRef.current = null;
    setIsConfirmOpen(false);
  }, [isDirty]);

  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!isDirty) return;
      event.preventDefault();
      event.returnValue = confirmMessage;
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [confirmMessage, isDirty]);

  return {
    isConfirmOpen,
    requestNavigation,
    cancelNavigation,
    confirmNavigation,
  };
}
