/**
 * useWelcomeOverlay — Controls visibility of the first-login welcome screen.
 *
 * WHAT: Shows WelcomeOverlay once for new users; checks profiles.welcome_dismissed_at.
 * WHERE: Used in MainLayout or AppRouter to conditionally render the overlay.
 * WHY: Gentle onboarding without disrupting existing flows.
 */

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useTenant } from '@/contexts/TenantContext';
import { supabase } from '@/integrations/supabase/client';

export function useWelcomeOverlay() {
  const { user, profile } = useAuth();
  const { tenant } = useTenant();
  const [showWelcome, setShowWelcome] = useState(false);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (!user?.id || checked) return;

    // Only show welcome overlay for free-tier or gardener-granted tenants
    // Demo, paid, and other tenant types should not see it
    const isEligible =
      !tenant ||
      tenant.tier === 'free' ||
      tenant.billing_mode === 'gardener_granted' ||
      tenant.is_operator_granted === true;

    if (!isEligible) {
      setChecked(true);
      return;
    }

    async function check() {
      try {
        const { data } = await supabase
          .from('profiles')
          .select('welcome_dismissed_at')
          .eq('user_id', user!.id)
          .maybeSingle();

        if (data && !(data as any).welcome_dismissed_at) {
          const sessionKey = `welcome-deferred-${user!.id}`;
          if (!sessionStorage.getItem(sessionKey)) {
            setShowWelcome(true);
          }
        }
      } catch {
        // Silently fail — don't block the app
      }
      setChecked(true);
    }

    check();
  }, [user?.id, checked, tenant]);

  const dismiss = (permanent?: boolean) => {
    setShowWelcome(false);
    if (!permanent && user?.id) {
      sessionStorage.setItem(`welcome-deferred-${user.id}`, '1');
    }
  };

  return { showWelcome, dismiss };
}
