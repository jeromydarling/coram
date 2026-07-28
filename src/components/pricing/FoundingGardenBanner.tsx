/**
 * FoundingGardenBanner — Calm promotional banner for the Founding Garden program.
 *
 * WHAT: Shows a gentle invitation for the first 20 founding members.
 * WHERE: /pricing page, above the tier cards.
 * WHY: Revenue trust layer — auto-reverts when cap is reached, leaving pricing page untouched.
 */

import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Sprout } from 'lucide-react';
import { Switch } from '@/components/ui/switch';

interface FoundingGardenBannerProps {
  optedIn: boolean;
  onToggle: (v: boolean) => void;
}

interface ProgramStatus {
  ok: boolean;
  is_active: boolean;
  cap: number;
  purchased_count: number;
  remaining: number;
  is_available: boolean;
}

export function FoundingGardenBanner({ optedIn, onToggle }: FoundingGardenBannerProps) {
  const { data: status, isLoading } = useQuery<ProgramStatus>({
    queryKey: ['founding-garden-status'],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('founding-garden-status');
      if (error) throw error;
      return data as ProgramStatus;
    },
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  // If loading, unavailable, or errored — render nothing (full revert)
  if (isLoading || !status?.is_available) return null;

  return (
    <div className="max-w-md mx-auto mb-10">
      <div
        className="rounded-2xl border border-[hsl(var(--marketing-border))] bg-[hsl(var(--marketing-surface))] p-5"
      >
        <div className="flex items-start gap-3 mb-3">
          <div className="p-2 rounded-lg bg-[hsl(var(--marketing-blue)/0.08)]">
            <Sprout className="h-5 w-5 text-[hsl(var(--marketing-blue))]" />
          </div>
          <div className="flex-1">
            <h3
              className="text-sm font-semibold text-[hsl(var(--marketing-navy))] mb-0.5"
              style={{ fontFamily: 'Georgia, serif' }}
            >
              Founding Garden
            </h3>
            <p className="text-xs text-[hsl(var(--marketing-navy)/0.5)] leading-relaxed">
              Join the first {status.cap} communities shaping what CROS becomes.
              Founding members receive annual pricing and early voice in the ecosystem.
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-[hsl(var(--marketing-border))]">
          <span className="text-xs text-[hsl(var(--marketing-navy)/0.4)]">
            {status.remaining} of {status.cap} remaining
          </span>
          <label className="flex items-center gap-2 cursor-pointer">
            <span className="text-xs text-[hsl(var(--marketing-navy)/0.6)]">
              {optedIn ? 'Added' : 'Add to my plan'}
            </span>
            <Switch
              checked={optedIn}
              onCheckedChange={onToggle}
            />
          </label>
        </div>
      </div>
    </div>
  );
}
