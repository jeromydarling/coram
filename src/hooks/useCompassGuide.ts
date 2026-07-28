/**
 * useCompassGuide — Contextual onboarding guide for new users.
 *
 * WHAT: Detects route changes and provides guide content for the current section.
 * WHERE: AIChatButton / AIChatDrawer — triggers auto-open with guide card.
 * WHY: New users feel overwhelmed by terminology and feature density.
 *      During first 2 sessions, the Compass opens when entering new sections
 *      and explains what they're looking at in gentle, human language.
 */

import { useEffect, useRef, useCallback, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useTenant } from '@/contexts/TenantContext';
import { matchGuide, type GuideEntry } from '@/content/compassGuide';

/** How many days after first login the guide remains active */
const GUIDE_WINDOW_DAYS = 3;

interface GuideState {
  guide_completed_at: string | null;
  guide_sections_seen: string[];
}

export function useCompassGuide(
  isOpen: boolean,
  setIsOpen: (open: boolean) => void
) {
  const { user } = useAuth();
  const { tenantId } = useTenant();
  const location = useLocation();
  const qc = useQueryClient();
  const lastTriggeredPath = useRef<string | null>(null);
  const key = ['compass-guide-state', user?.id, tenantId];

  // Fetch guide state from compass_user_state
  const { data: guideState, isLoading } = useQuery({
    queryKey: key,
    enabled: !!user?.id && !!tenantId,
    staleTime: 60_000,
    queryFn: async () => {
      const { data: row } = await supabase
        .from('compass_user_state')
        .select('guide_completed_at, guide_sections_seen')
        .eq('user_id', user!.id)
        .eq('tenant_id', tenantId!)
        .maybeSingle();
      return (row ?? { guide_completed_at: null, guide_sections_seen: [] }) as GuideState;
    },
  });

  // Check if the user is within the guide window (based on user created_at)
  const isWithinWindow = useMemo(() => {
    if (!user?.created_at) return false;
    const createdAt = new Date(user.created_at);
    const cutoff = new Date(createdAt.getTime() + GUIDE_WINDOW_DAYS * 24 * 60 * 60 * 1000);
    return new Date() < cutoff;
  }, [user?.created_at]);

  // Is guide active? Within window AND not completed
  const guideActive = useMemo(() => {
    if (isLoading || !guideState) return false;
    if (guideState.guide_completed_at) return false;
    return isWithinWindow;
  }, [isLoading, guideState, isWithinWindow]);

  // Get current guide entry
  const currentGuide = useMemo((): GuideEntry | null => {
    if (!guideActive) return null;
    // Only show guide on app routes, not marketing/auth
    const path = location.pathname;
    if (path.startsWith('/login') || path.startsWith('/signup') || path.startsWith('/onboarding') || path.startsWith('/operator')) return null;
    return matchGuide(path);
  }, [guideActive, location.pathname]);

  // Has this section already been shown?
  const sectionAlreadySeen = useMemo(() => {
    if (!currentGuide || !guideState) return true;
    return (guideState.guide_sections_seen || []).includes(currentGuide.title);
  }, [currentGuide, guideState]);

  // Mark a section as seen
  const markSeen = useMutation({
    mutationFn: async (sectionTitle: string) => {
      const currentSeen = guideState?.guide_sections_seen || [];
      const nextSeen = [...new Set([...currentSeen, sectionTitle])];
      await supabase
        .from('compass_user_state')
        .upsert({
          user_id: user!.id,
          tenant_id: tenantId!,
          guide_sections_seen: nextSeen,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id,tenant_id' });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });

  // Complete guide permanently
  const completeGuide = useMutation({
    mutationFn: async () => {
      await supabase
        .from('compass_user_state')
        .upsert({
          user_id: user!.id,
          tenant_id: tenantId!,
          guide_completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id,tenant_id' });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });

  // Auto-open compass when entering a new section for the first time
  useEffect(() => {
    if (!guideActive || !currentGuide || sectionAlreadySeen || isOpen) return;
    if (lastTriggeredPath.current === location.pathname) return;

    lastTriggeredPath.current = location.pathname;
    // Small delay so the page renders first
    const timer = setTimeout(() => {
      setIsOpen(true);
      markSeen.mutate(currentGuide.title);
    }, 800);

    return () => clearTimeout(timer);
  }, [guideActive, currentGuide, sectionAlreadySeen, isOpen, location.pathname]);

  return {
    /** Whether the guide system is active for this user */
    guideActive,
    /** Current section guide entry (null if no match or already seen) */
    currentGuide: guideActive && currentGuide && !sectionAlreadySeen ? currentGuide : null,
    /** Current guide even if already seen (for showing in open drawer) */
    currentGuideAlways: guideActive ? currentGuide : null,
    /** Dismiss the guide permanently */
    completeGuide: completeGuide.mutate,
    /** Mark a section as seen */
    markSectionSeen: markSeen.mutate,
  };
}
