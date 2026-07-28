import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/contexts/TenantContext';
import { Sparkles } from 'lucide-react';

export function NriBadge() {
  const { t } = useTranslation('dashboard');
  const { tenant } = useTenant();

  const { data } = useQuery({
    queryKey: ['nri-badge', tenant?.id],
    queryFn: async () => {
      if (!tenant?.id) return null;
      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

      const [signalsRes, reportsRes] = await Promise.all([
        supabase
          .from('nri_signals')
          .select('*', { count: 'exact', head: true })
          .eq('tenant_id', tenant.id)
          .gte('created_at', weekAgo),
        supabase
          .from('testimonium_reports')
          .select('*', { count: 'exact', head: true })
          .eq('tenant_id', tenant.id),
      ]);

      return {
        signalsThisWeek: signalsRes.count || 0,
        totalReports: reportsRes.count || 0,
      };
    },
    enabled: !!tenant?.id,
    refetchInterval: 120_000,
  });

  if (!data) return null;

  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-primary/5 border border-primary/10">
      <Sparkles className="w-4 h-4 text-primary" />
      <span className="text-sm text-foreground font-medium">{t('nriBadge.active')}</span>
      <span className="text-xs text-muted-foreground">
        {t('nriBadge.signalsAndReports', { signals: data.signalsThisWeek, reports: data.totalReports })}
      </span>
    </div>
  );
}
