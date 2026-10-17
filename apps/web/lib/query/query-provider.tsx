"use client";

import { QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState, type ReactNode } from "react";
import { installHistoryPositions } from '@/lib/navigation/history-position';
import { createQueryClient } from "./query-client";

type Props = {
  children: ReactNode;
};

export default function QueryProvider({ children }: Props) {
  const [queryClient] = useState(() => createQueryClient());
  useEffect(() => { installHistoryPositions(); }, []);

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
