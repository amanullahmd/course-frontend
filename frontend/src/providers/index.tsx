"use client";

import * as React from "react";
import { MutationCache, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { ThemeProvider, useTheme } from "next-themes";
import { Toaster, toast } from "sonner";
import { isApiError, setApiLocale } from "@/lib/api/client";
import { useErrorMessage } from "@/hooks/use-error-message";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "./auth-provider";

declare module "@tanstack/react-query" {
  interface Register {
    mutationMeta: { suppressErrorToast?: boolean };
  }
}

function makeQueryClient(onMutationError: (error: unknown) => void) {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        refetchOnWindowFocus: false,
        throwOnError: false,
        retry: (failureCount, error) => {
          if (isApiError(error) && error.status >= 400 && error.status < 500) return false;
          return failureCount < 2;
        },
      },
      mutations: { throwOnError: false },
    },
    mutationCache: new MutationCache({
      onError: (error, _variables, _context, mutation) => {
        if (mutation.meta?.suppressErrorToast) return;
        onMutationError(error);
      },
    }),
  });
}

function ThemedToaster() {
  const { resolvedTheme } = useTheme();
  return (
    <Toaster
      theme={resolvedTheme === "dark" ? "dark" : "light"}
      position="bottom-right"
      closeButton
      richColors
      toastOptions={{ classNames: { toast: "!rounded-xl !shadow-lg !font-sans" } }}
    />
  );
}

export function Providers({ children, locale }: { children: React.ReactNode; locale: string }) {
  const errorMessage = useErrorMessage();
  const errorRef = React.useRef(errorMessage);
  React.useEffect(() => {
    errorRef.current = errorMessage;
  });
  const [queryClient] = React.useState(() => {
    setApiLocale(locale);
    return makeQueryClient((error) => toast.error(errorRef.current(error)));
  });
  React.useEffect(() => {
    setApiLocale(locale);
  }, [locale]);

  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <TooltipProvider delayDuration={300}>
            {children}
            <ThemedToaster />
          </TooltipProvider>
        </AuthProvider>
        {process.env.NODE_ENV === "development" && <ReactQueryDevtools buttonPosition="bottom-left" />}
      </QueryClientProvider>
    </ThemeProvider>
  );
}
