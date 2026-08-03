/**
 * The authenticated shell, mounted at /app.
 *
 * Two constraints shape everything under here:
 *   §10  no analytics, no session recording, no third-party trackers. Ever.
 *   §8.4 no motion at all inside /app. The product is calm; the site moves.
 *
 * Every one of §5's eleven modules has a route below, and modules.test.ts
 * asserts it — a module in the spec with nowhere to go is a failing test rather
 * than something a person notices three weeks later.
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';

import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Advocacy } from '@/modules/Advocacy';
import { Coalition } from '@/modules/Coalition';
import { Drafting } from '@/modules/Drafting';
import { Events } from '@/modules/Events';
import { Governance } from '@/modules/Governance';
import { Login } from '@/modules/Login';
import { Messages } from '@/modules/Messages';
import { Money } from '@/modules/Money';
import { Outreach } from '@/modules/Outreach';
import { Overview } from '@/modules/Overview';
import { People } from '@/modules/People';
import { PeopleImport } from '@/modules/PeopleImport';
import { Relationships } from '@/modules/Relationships';
import { RequireSession } from '@/modules/RequireSession';
import { Safety } from '@/modules/Safety';
import { Settings } from '@/modules/Settings';
import { Studio } from '@/modules/Studio';
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

                {/* §5.1–5.11, in the order the sidebar groups them. */}
                <Route path="/people" element={<People />} />
                <Route path="/people/import" element={<PeopleImport />} />
                <Route path="/relationships" element={<Relationships />} />
                <Route path="/events" element={<Events />} />
                <Route path="/outreach" element={<Outreach />} />
                <Route path="/advocacy" element={<Advocacy />} />
                <Route path="/money" element={<Money />} />
                <Route path="/messages" element={<Messages />} />
                <Route path="/governance" element={<Governance />} />
                <Route path="/safety" element={<Safety />} />
                <Route path="/drafting" element={<Drafting />} />
                <Route path="/coalition" element={<Coalition />} />

                {/* Not a module — §5 is closed at eleven. Studio is a Brand
                    surface built from Convocare data, and Workspace is
                    configuration. Both live below the nav's module groups. */}
                <Route path="/studio" element={<Studio />} />
                <Route path="/settings" element={<Settings />} />
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
