import { useState, useEffect } from 'react';
import { Download, X, Share } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { usePWAInstall } from '@/hooks/usePWAInstall';
import { useIsMobile } from '@/hooks/use-mobile';

function isIOS(): boolean {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
}

function isInStandaloneMode(): boolean {
  return window.matchMedia('(display-mode: standalone)').matches 
    || (window.navigator as any).standalone === true;
}

export function InstallPrompt() {
  const { isInstallable, isInstalled, promptInstall, dismissPrompt } = usePWAInstall();
  const isMobile = useIsMobile();
  const [showIOSPrompt, setShowIOSPrompt] = useState(false);

  useEffect(() => {
    // Check if we should show iOS-specific prompt
    if (isMobile && isIOS() && !isInStandaloneMode()) {
      // Check if user dismissed recently
      const dismissed = localStorage.getItem('pwa-install-dismissed');
      if (dismissed) {
        const dismissedTime = parseInt(dismissed, 10);
        const sevenDays = 7 * 24 * 60 * 60 * 1000;
        if (Date.now() - dismissedTime < sevenDays) {
          return;
        }
      }
      // Delay showing to not be intrusive
      const timer = setTimeout(() => setShowIOSPrompt(true), 3000);
      return () => clearTimeout(timer);
    }
  }, [isMobile]);

  const handleDismiss = () => {
    dismissPrompt();
    setShowIOSPrompt(false);
    localStorage.setItem('pwa-install-dismissed', Date.now().toString());
  };

  // iOS-specific prompt with share instructions
  if (showIOSPrompt && isIOS()) {
    return (
      <div className="fixed bottom-20 left-4 right-4 z-50 animate-in slide-in-from-bottom-4 duration-300">
        <div className="bg-card border border-border rounded-xl shadow-lg p-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <Download className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-foreground text-sm">Install CROS</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Tap <Share className="w-3 h-3 inline mx-0.5" /> then "Add to Home Screen"
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="shrink-0 -mt-1 -mr-1 h-8 w-8"
              onClick={handleDismiss}
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="w-full mt-3"
            onClick={handleDismiss}
          >
            Got it
          </Button>
        </div>
      </div>
    );
  }

  // Android/Chrome/Desktop prompt with native install
  if (!isInstallable || isInstalled) {
    return null;
  }

  return (
    <div className="fixed bottom-20 left-4 right-4 z-50 animate-in slide-in-from-bottom-4 duration-300">
      <div className="bg-card border border-border rounded-xl shadow-lg p-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <Download className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-foreground text-sm">Install CROS</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Add to your home screen for quick access
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="shrink-0 -mt-1 -mr-1 h-8 w-8"
            onClick={handleDismiss}
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
        <div className="flex gap-2 mt-3">
          <Button
            variant="outline"
            size="sm"
            className="flex-1"
            onClick={handleDismiss}
          >
            Not now
          </Button>
          <Button
            size="sm"
            className="flex-1"
            onClick={promptInstall}
          >
            Install
          </Button>
        </div>
      </div>
    </div>
  );
}
