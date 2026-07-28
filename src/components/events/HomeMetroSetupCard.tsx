/**
 * HomeMetroSetupCard → HomeTerritorySetupCard
 *
 * WHAT: Prompts the user to choose a home territory from their activated territories.
 * WHERE: Local Pulse section when no home territory is set, or when changing home territory.
 * WHY: Replaces legacy metro-only selector with unified territory model.
 *      Auto-triggers Local Pulse discovery on first set.
 */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MapPin, Loader2, X } from 'lucide-react';
import { useTenantTerritories } from '@/hooks/useTenantTerritories';
import { useTerritories } from '@/hooks/useTerritories';
import { useMetroIntelligence } from '@/hooks/useMetroIntelligence';
import { useTenant } from '@/contexts/TenantContext';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/components/ui/sonner';

interface HomeMetroSetupCardProps {
  /** When provided, shows "Currently: {name}" and a cancel button */
  currentName?: string;
  onCancel?: () => void;
  onSaved?: () => void;
}

export function HomeMetroSetupCard({ currentName, onCancel, onSaved }: HomeMetroSetupCardProps) {
  const { t } = useTranslation('events');
  const { enabled: metroEnabled } = useMetroIntelligence();
  const { tenant } = useTenant();
  const { data: activatedTerritories, isLoading: atLoading } = useTenantTerritories();
  const { data: allTerritories, isLoading: tLoading } = useTerritories();
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<string>('');

  const setHomeMutation = useMutation({
    mutationFn: async (territoryId: string) => {
      if (!tenant?.id) throw new Error('No tenant');

      // Clear existing home flag
      await supabase
        .from('tenant_territories')
        .update({ is_home: false } as any)
        .eq('tenant_id', tenant.id)
        .eq('is_home', true);

      // Check if territory is already activated
      const existing = activatedTerritories?.find(t => t.territory_id === territoryId);

      if (existing) {
        // Update existing activation to home
        const { error } = await supabase
          .from('tenant_territories')
          .update({ is_home: true } as any)
          .eq('tenant_id', tenant.id)
          .eq('territory_id', territoryId);
        if (error) throw error;
      } else {
        // Insert new activation as home
        const { error } = await supabase
          .from('tenant_territories')
          .insert({
            tenant_id: tenant.id,
            territory_id: territoryId,
            is_home: true,
            activation_slots: 1,
          } as any);
        if (error) throw error;
      }

      // Resolve the metro_id for the selected territory to trigger Local Pulse
      const territory = (activatedTerritories?.find(t => t.territory_id === territoryId)) 
        || (allTerritories || []).find(t => t.id === territoryId);
      const metroId = (territory as any)?.metro_id || territoryId;

      // Auto-trigger Local Pulse discovery for the new home territory
      try {
        await supabase.functions.invoke('local-pulse-worker', {
          body: { metro_id: metroId, run_kind: 'manual', force: true, tenant_id: tenant?.id },
        });
      } catch (e) {
        // Non-blocking — the weekly schedule will catch up
        console.warn('[HomeMetroSetupCard] Initial pulse trigger failed:', e);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['home-territory'] });
      queryClient.invalidateQueries({ queryKey: ['tenant-territories'] });
      queryClient.invalidateQueries({ queryKey: ['local-pulse-events'] });
      queryClient.invalidateQueries({ queryKey: ['local-pulse-events-count'] });
      queryClient.invalidateQueries({ queryKey: ['local-pulse-last-run'] });
      toast.success(t('homeTerritory.successToast'));
      onSaved?.();
    },
    onError: (err: Error) => {
      const msg = err.message || '';
      if (msg.includes('row-level security') || msg.includes('RLS')) {
        toast.error(t('homeTerritory.errorPermission'));
      } else {
        toast.error(t('homeTerritory.errorGeneric'));
      }
      console.error('[HomeMetroSetupCard] Error:', msg);
    },
  });

  // HomeMetroSetupCard is available for all tenants
  if (atLoading || tLoading) return null;

  // Show all available metro territories; mark activated ones
  const activatedIds = new Set((activatedTerritories || []).map(t => t.territory_id));
  const allMetros = (allTerritories || [])
    .filter(t => t.territory_type === 'metro')
    .map(t => ({
      id: t.id,
      label: t.state_code ? `${t.name}, ${t.state_code}` : t.name,
      activated: activatedIds.has(t.id),
    }));
  // Sort: activated first, then alphabetical
  const options = allMetros.sort((a, b) => {
    if (a.activated !== b.activated) return a.activated ? -1 : 1;
    return a.label.localeCompare(b.label);
  });

  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center gap-2">
          <MapPin className="w-4 h-4 text-primary" />
          <span className="text-sm font-medium">
            {currentName ? t('homeTerritory.changeTitle') : t('homeTerritory.chooseTitle')}
          </span>
          {onCancel && (
            <Button variant="ghost" size="icon" className="ml-auto h-6 w-6" onClick={onCancel}>
              <X className="w-3 h-3" />
            </Button>
          )}
        </div>
        {currentName && (
          <p className="text-xs text-muted-foreground">{t('homeTerritory.currently')}<strong>{currentName}</strong></p>
        )}
        <p className="text-xs text-muted-foreground">
          {t('homeTerritory.description')}
        </p>
        <div className="flex items-center gap-2">
          <Select value={selected} onValueChange={setSelected}>
            <SelectTrigger className="flex-1 h-8 text-xs">
              <SelectValue placeholder={t('homeTerritory.selectPlaceholder')} />
            </SelectTrigger>
            <SelectContent>
              {options.map(o => (
                <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            size="sm"
            className="h-8 text-xs"
            disabled={!selected || setHomeMutation.isPending}
            onClick={() => setHomeMutation.mutate(selected)}
          >
            {setHomeMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : t('homeTerritory.set')}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}