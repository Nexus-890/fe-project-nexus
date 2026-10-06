"use client";

import { useState, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "../features/auth/AuthProvider";

export function AppProviders({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      mutations: { retry: 0 },
      queries: {
        gcTime: 5 * 60 * 1000,
        refetchOnWindowFocus: false,
        retry: 1,
        staleTime: 30_000,
      },
    },
  }));

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider
        baseUrl={process.env.NEXT_PUBLIC_API_URL ?? process.env.NEXT_PUBLIC_API_BASE_URL}
        stub={process.env.NEXT_PUBLIC_AUTH_STUB === "true"}
      >
        {children}
      </AuthProvider>
    </QueryClientProvider>
  );
}
