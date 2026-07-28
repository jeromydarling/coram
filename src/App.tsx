// CROS App Root — Communal Relationship Operating System
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ViewModeProvider } from "@/contexts/ViewModeContext";
import { TenantProvider } from "@/contexts/TenantContext";
import { EmailInsightsPanelProvider } from "@/contexts/EmailInsightsPanelContext";
import { GlobalModalProvider } from "@/contexts/GlobalModalContext";
import { ImpersonationProvider } from "@/contexts/ImpersonationContext";
import { DemoModeProvider } from "@/contexts/DemoModeContext";
import { AIChatButton } from "@/components/ai/AIChatButton";
import { GlobalBundleReviewPanel } from "@/components/ai/GlobalBundleReviewPanel";
import { DemoBanner } from "@/components/demo/DemoBanner";
import { DemoGuidedTour } from "@/components/demo/DemoGuidedTour";
import { GlobalModals } from "@/components/modals/GlobalModals";
import { GlobalEffects } from "@/components/GlobalEffects";

import ScrollToTop from "@/components/ScrollToTop";
import { AppRouter } from "@/components/routing/AppRouter";
import { OperatorErrorBoundary } from "@/components/operator/OperatorErrorBoundary";
import { initOperatorErrorCapture } from "@/lib/operatorErrorCapture";

// Initialize global error capture (runs once)
initOperatorErrorCapture();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      staleTime: 30_000, // 30s stale-while-revalidate
      gcTime: 5 * 60_000, // 5min garbage collection
      retry: 1,
    },
  },
});

const App = () => (
  <OperatorErrorBoundary>
  <QueryClientProvider client={queryClient}>
    <DemoModeProvider>
    <AuthProvider>
      <ViewModeProvider>
      <TenantProvider>
      <TooltipProvider>
        <EmailInsightsPanelProvider>
        <GlobalModalProvider>
        <ImpersonationProvider>
          <GlobalEffects sourceApp="thecros" />
          <Toaster />
          <Sonner />
          
          <GlobalBundleReviewPanel />
          <GlobalModals />
          <BrowserRouter>
            <DemoBanner />
            <DemoGuidedTour />
            <ScrollToTop />
            <AIChatButton />
            <AppRouter />
          </BrowserRouter>
        </ImpersonationProvider>
        </GlobalModalProvider>
        </EmailInsightsPanelProvider>
      </TooltipProvider>
      </TenantProvider>
      </ViewModeProvider>
    </AuthProvider>
    </DemoModeProvider>
  </QueryClientProvider>
  </OperatorErrorBoundary>
);

export default App;
