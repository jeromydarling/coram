/**
 * The authenticated shell, mounted at /app.
 *
 * Two constraints shape everything under here:
 *   §10  no analytics, no session recording, no third-party trackers. Ever.
 *   §8.4 no motion at all inside /app. The product is calm; the site moves.
 *
 * Modules mount under /app/<module> as they land, in the §9 order.
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';

import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      staleTime: 30_000,
      retry: 1,
    },
  },
});

function Placeholder() {
  return (
    <main className="mx-auto max-w-xl p-8">
      <h1 className="text-lg font-semibold">Coram</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Foundation is in place: tenancy, roles, RLS, audit, retention, burn switch. Membra is next.
      </p>
    </main>
  );
}

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <BrowserRouter basename="/app">
          <Routes>
            <Route path="/" element={<Placeholder />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}
