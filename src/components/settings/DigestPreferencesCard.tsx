/**
 * DigestPreferencesCard — Living Pulse Digest preferences.
 *
 * WHAT: Controls email digest frequency and content sections for the current user.
 * WHERE: Settings page → Communication section.
 * WHY: Every role deserves gentle, rhythmic updates — not noise.
 */
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useTenant } from '@/contexts/TenantContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { HelpTooltip } from '@/components/ui/help-tooltip';
import { toast } from '@/components/ui/sonner';
import { Mail } from 'lucide-react';

interface DigestPref {
  user_id: string;
  tenant_id: string;
  frequency: string;
  include_visits: boolean;
  include_projects: boolean;
  include_narratives: boolean;
  include_network: boolean;
  include_system: boolean;
  include_essays: boolean;
  include_living_pulse: boolean;
}

const SECTION_TOGGLE_KEYS = [
  { key: 'include_visits', labelKey: 'digest.sections.visits', descKey: 'digest.sections.visitsDesc' },
  { key: 'include_projects', labelKey: 'digest.sections.projects', descKey: 'digest.sections.projectsDesc' },
  { key: 'include_narratives', labelKey: 'digest.sections.narratives', descKey: 'digest.sections.narrativesDesc' },
  { key: 'include_network', labelKey: 'digest.sections.network', descKey: 'digest.sections.networkDesc' },
  { key: 'include_essays', labelKey: 'digest.sections.essays', descKey: 'digest.sections.essaysDesc' },
  { key: 'include_living_pulse', labelKey: 'digest.sections.livingPulse', descKey: 'digest.sections.livingPulseDesc' },
  { key: 'include_system', labelKey: 'digest.sections.system', descKey: 'digest.sections.systemDesc' },
] as const;

export default function DigestPreferencesCard() {
  const { t } = useTranslation('settings');
  const { user } = useAuth();
  const { tenant } = useTenant();
  const qc = useQueryClient();

  const { data: pref, isLoading } = useQuery({
    queryKey: ['digest-prefs', user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_digest_preferences')
        .select('*')
        .eq('user_id', user!.id)
        .maybeSingle();
      if (error) throw error;
      return data as DigestPref | null;
    },
  });

  const upsertMutation = useMutation({
    mutationFn: async (updates: Partial<DigestPref>) => {
      const payload = {
        user_id: user!.id,
        tenant_id: tenant?.id ?? null,
        frequency: updates.frequency ?? pref?.frequency ?? 'weekly',
        include_visits: updates.include_visits ?? pref?.include_visits ?? true,
        include_projects: updates.include_projects ?? pref?.include_projects ?? true,
        include_narratives: updates.include_narratives ?? pref?.include_narratives ?? true,
        include_network: updates.include_network ?? pref?.include_network ?? true,
        include_system: updates.include_system ?? pref?.include_system ?? false,
        include_essays: updates.include_essays ?? pref?.include_essays ?? false,
        include_living_pulse: updates.include_living_pulse ?? pref?.include_living_pulse ?? true,
      };
      const { error } = await supabase
        .from('user_digest_preferences')
        .upsert(payload, { onConflict: 'user_id' });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['digest-prefs'] });
      toast.success(t('digest.updated'));
    },
  });

  const currentFrequency = pref?.frequency ?? 'weekly';
  const isOff = currentFrequency === 'off';

  const getValue = (key: string): boolean => {
    if (pref && key in pref) return (pref as any)[key];
    if (key === 'include_system' || key === 'include_essays') return false;
    return true;
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Mail className="w-4 h-4 text-primary" />
          <CardTitle className="text-base">{t('digest.title')}</CardTitle>
          <HelpTooltip
            what={t('digest.tooltipWhat')}
            where={t('digest.tooltipWhere')}
            why={t('digest.tooltipWhy')}
          />
        </div>
        <CardDescription>
          {t('digest.description')}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Frequency */}
        <div className="space-y-1.5">
          <Label className="text-sm">{t('digest.rhythmLabel')}</Label>
          <Select
            value={currentFrequency}
            disabled={isLoading || upsertMutation.isPending}
            onValueChange={(frequency) => upsertMutation.mutate({ frequency })}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="daily">{t('digest.daily')}</SelectItem>
              <SelectItem value="weekly">{t('digest.weekly')}</SelectItem>
              <SelectItem value="monthly">{t('digest.monthly')}</SelectItem>
              <SelectItem value="off">{t('digest.off')}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {!isOff && (
          <>
            <Separator />
            <div className="space-y-1">
              <Label className="text-sm font-medium">{t('digest.whatToInclude')}</Label>
              <p className="text-xs text-muted-foreground">
                {t('digest.whatToIncludeDesc')}
              </p>
            </div>

            <div className="space-y-3">
              {SECTION_TOGGLE_KEYS.map(({ key, labelKey, descKey }) => (
                <div key={key} className="flex items-start justify-between gap-3">
                  <div className="space-y-0.5 min-w-0">
                    <Label htmlFor={`digest-${key}`} className="text-sm leading-tight">
                      {t(labelKey)}
                    </Label>
                    <p className="text-xs text-muted-foreground">{t(descKey)}</p>
                  </div>
                  <Switch
                    id={`digest-${key}`}
                    checked={getValue(key)}
                    disabled={isLoading || upsertMutation.isPending}
                    onCheckedChange={(checked) => upsertMutation.mutate({ [key]: checked } as any)}
                  />
                </div>
              ))}
            </div>
          </>
        )}

        <p className="text-xs text-muted-foreground pt-2">
          {t('digest.footer')}
        </p>
      </CardContent>
    </Card>
  );
}
