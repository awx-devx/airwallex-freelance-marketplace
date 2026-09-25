"use client";

import { MutationCache, QueryCache, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ApiError } from "@/lib/api/errors";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";

declare module "@tanstack/react-query" {
  interface Register {
    mutationMeta: {
      toastError?: boolean;
    };
  }
}

function createQueryClient(redirectToLogin: () => void) {
  const queryClient = new QueryClient({
    queryCache: new QueryCache({
      onError: (error) => {
        if (error instanceof ApiError && error.status === 401) {
          queryClient.clear();
          redirectToLogin();
        }
      },
    }),
    mutationCache: new MutationCache({
      onError: (error, _variables, _context, mutation) => {
        if (mutation.meta?.toastError === false) return;
        const message = error instanceof Error ? error.message : "Something went wrong";
        toast.error(message);
      },
    }),
    defaultOptions: {
      queries: {
        staleTime: 15_000,
        retry: (failureCount, error) =>
          !(error instanceof ApiError && error.status < 500) && failureCount < 2,
        refetchOnWindowFocus: true,
      },
      mutations: { retry: false },
    },
  });

  return queryClient;
}

let redirectToLogin = () => {};

export function Providers({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  useEffect(() => {
    redirectToLogin = () => {
      router.replace("/login");
    };
    return () => {
      redirectToLogin = () => {};
    };
  }, [router]);

  const [queryClient] = useState(() => createQueryClient(() => redirectToLogin()));

  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          {children}
          <Toaster />
          {process.env.NODE_ENV === "development" ? <ReactQueryDevtools initialIsOpen={false} /> : null}
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}
