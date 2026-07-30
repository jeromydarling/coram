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
import { Bills } from '@/modules/Bills';
import { Contacts } from '@/modules/Contacts';
import { Decisions } from '@/modules/Decisions';
import { Events } from '@/modules/Events';
import { Funds } from '@/modules/Funds';
import { Login } from '@/modules/Login';
import { Overview } from '@/modules/Overview';
import { RequireSession } from '@/modules/RequireSession';
import { Shell } from '@/modules/Shell';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      staleTime: 30_000,
      retry: 1,
    },
  },
});

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <BrowserRouter basename="/app">
          <Routes>
            <Route path="/login" element={<Login />} />
            {/* Everything below requires a session. RequireSession asks the
                Worker rather than trusting anything in localStorage — the
                session is an HttpOnly cookie and this app deliberately holds
                no token it could inspect. */}
            <Route element={<RequireSession />}>
              <Route element={<Shell />}>
                <Route path="/" element={<Overview />} />
                <Route path="/contacts" element={<Contacts />} />
                <Route path="/events" element={<Events />} />
                <Route path="/decisions" element={<Decisions />} />
                <Route path="/funds" element={<Funds />} />
                <Route path="/bills" element={<Bills />} />
              </Route>
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}
