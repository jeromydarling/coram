/**
 * SeasonalEchoCard — Displays archive-detected seasonal patterns in the Compass drawer.
 *
 * WHAT: Shows up to 3 non-dismissed archive candidates with dismiss + reflection actions.
 * WHERE: Compass drawer / GardenPulsePage.
 * WHY: Conservative seasonal echoes surface gentle pattern awareness without noise.
 *
 * GATE: Only renders when tenant_settings.seasonal_echoes_enabled = true AND candidates exist.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/contexts/TenantContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Sparkles, X, BookOpen } from 'lucide-react';
import { toast } from '@/components/ui/sonner';
import { HelpTooltip } from '@/components/ui/help-tooltip';

export function SeasonalEchoCard() {
  const { tenantId } = useTenant();
  const queryClient = useQueryClient();

  // Gate 1: Check tenant setting
  const { data: settingsEnabled } = useQuery({
    queryKey: ['tenant-settings-seasonal-echoes', tenantId],
    enabled: !!tenantId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tenant_settings')
        .select('seasonal_echoes_enabled')
        .eq('tenant_id', tenantId!)
        .maybeSingle();
      if (error) throw error;
      return data?.seasonal_echoes_enabled ?? false;
    },
  });

  const queryKey = ['seasonal-echo-candidates', tenantId];

  // Gate 2: Only fetch candidates if feature is enabled
  const { data: candidates } = useQuery({
    queryKey,
    enabled: !!tenantId && settingsEnabled === true,
    queryFn: async () => {
      const { data, error } = await (supabase
        .from('archive_suggestion_candidates' as any)
        .select('*')
        .eq('tenant_id', tenantId!)
        .eq('dismissed', false)
        .order('confidence', { ascending: false })
        .limit(3) as any);
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  const dismissMutation = useMutation({
    mutationFn: async (candidateId: string) => {
      const { error } = await (supabase
        .from('archive_suggestion_candidates' as any)
        .update({ dismissed: true })
        .eq('id', candidateId) as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });

  const generateReflection = useMutation({
    mutationFn: async (candidate: any) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await (supabase
        .from('archive_reflections' as any)
        .insert({
          tenant_id: tenantId,
          entity_type: candidate.entity_type,
          entity_id: candidate.entity_id,
          candidate_id: candidate.id,
          status: 'draft',
          created_by: user?.id ?? null,
        }) as any);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Reflection draft created');
      queryClient.invalidateQueries({ queryKey });
    },
    onError: () => toast.error('Could not create reflection'),
  });

  // Render nothing if feature disabled or no candidates
  if (!settingsEnabled || !candidates?.length) return null;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-primary" />
          Seasonal Echoes
          <HelpTooltip
            what="Patterns detected from similar periods in previous years — anniversaries, cyclical rhythms, or seasonal shifts."
            where="Compass drawer"
            why="Gentle awareness of recurring patterns helps inform discernment without creating pressure."
          />
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {candidates.map((c: any) => (
          <div key={c.id} className="flex items-start justify-between gap-2 p-2 rounded-lg border border-border/60 text-sm">
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">
                {c.pattern_type === 'anniversary' ? '🕯️ Anniversary pattern' : 
                 c.pattern_type === 'cyclical' ? '🔄 Cyclical pattern' : '🌿 Seasonal echo'}
              </p>
              <p className="text-xs mt-0.5 truncate">{c.pattern_key}</p>
            </div>
            <div className="flex gap-1 shrink-0">
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7"
                title="Generate reflection"
                onClick={() => generateReflection.mutateAsync(c)}
              >
                <BookOpen className="w-3.5 h-3.5" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7"
                onClick={() => dismissMutation.mutateAsync(c.id)}
              >
                <X className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
