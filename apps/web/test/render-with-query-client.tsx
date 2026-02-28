import { QueryClientProvider, type QueryClient } from "@tanstack/react-query";
import { render, type RenderOptions } from "@testing-library/react";
import type { ReactElement, ReactNode } from "react";
import { createQueryClient } from "@/lib/query/query-client";

type Options = Omit<RenderOptions, "wrapper"> & {
  queryClient?: QueryClient;
};

export const renderWithQueryClient = (ui: ReactElement, options: Options = {}) => {
  const queryClient = options.queryClient ?? createQueryClient();

  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  return {
    queryClient,
    ...render(ui, {
      wrapper: Wrapper,
      ...options,
    }),
  };
};
