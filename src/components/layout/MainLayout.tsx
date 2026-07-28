import { ReactNode, useState } from 'react';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { SkipToContent } from './SkipToContent';
import { cn } from '@/lib/utils';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { useAccessibilityMode } from '@/hooks/useAccessibilityMode';
import { ImpersonationBanner } from '@/components/impersonation/ImpersonationBanner';
import { TenantViewBanner } from '@/components/operator/TenantViewBanner';
import { SeasonalRhythmBar } from '@/components/layout/SeasonalRhythmBar';
import { AnnouncementBanner } from '@/components/operator/AnnouncementBanner';
import { WelcomeOverlay } from '@/components/welcome/WelcomeOverlay';
import { useWelcomeOverlay } from '@/hooks/useWelcomeOverlay';
import { KeyboardShortcutsOverlay } from '@/components/keyboard/KeyboardShortcutsOverlay';
import type { HelpKey } from '@/lib/helpContent';
import { CompanionTray } from '@/components/companion/CompanionTray';
import { useDemoMode } from '@/contexts/DemoModeContext';

export interface MainLayoutProps {
  children: ReactNode;
  title: string;
  mobileTitle?: string;
  subtitle?: string;
  headerActions?: ReactNode;
  helpKey?: HelpKey;
  'data-testid'?: string;
}

export function MainLayout({ children, title, mobileTitle, subtitle, headerActions, helpKey, 'data-testid': testId }: MainLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { showWelcome, dismiss } = useWelcomeOverlay();
  const { isDemoMode } = useDemoMode();
  // Enable global keyboard shortcuts
  const { shortcutsOpen, setShortcutsOpen } = useKeyboardShortcuts();
  
  // Initialize accessibility mode (syncs class to <html>)
  useAccessibilityMode();

  return (
    <div className={cn("min-h-screen bg-background", isDemoMode && "pt-10")} data-testid={testId}>
      <SkipToContent />
      {showWelcome && <WelcomeOverlay onDismiss={() => dismiss(false)} />}
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="lg:pl-64 min-h-screen flex flex-col transition-all duration-300">
        <TenantViewBanner />
        <ImpersonationBanner />
        <div className="hidden md:block">
          <AnnouncementBanner />
          <SeasonalRhythmBar />
        </div>
        <Header 
          title={title}
          mobileTitle={mobileTitle}
          subtitle={subtitle} 
          onMenuClick={() => setSidebarOpen(true)}
          headerActions={headerActions}
          helpKey={helpKey}
        />
        <main id="main-content" className="flex-1 p-4 md:p-6 overflow-auto" role="main">
          {children}
        </main>
      </div>
      <CompanionTray />
      <KeyboardShortcutsOverlay open={shortcutsOpen} onOpenChange={setShortcutsOpen} />
    </div>
  );
}
