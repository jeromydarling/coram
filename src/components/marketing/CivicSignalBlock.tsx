/**
 * CivicSignalBlock — Anonymized civic trust signals from the CROS™ network.
 *
 * WHAT: Shows aggregated metro insights from published public_metro_pages.
 * WHERE: Marketing pages, archetype pages, metro pages.
 * WHY: Builds trust through civic awareness — no tenant identifiers allowed.
 */
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { MapPin } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const serif = { fontFamily: 'Georgia, "Times New Roman", serif' };

export default function CivicSignalBlock() {
  const { t } = useTranslation('marketing');
  const { data: pages } = useQuery({
    queryKey: ['civic-signals-published'],
    queryFn: async () => {
      const { data } = await supabase
        .from('public_metro_pages')
        .select('display_name, momentum_summary, slug')
        .eq('status', 'published')
        .order('updated_at', { ascending: false })
        .limit(3);
      return data || [];
    },
    staleTime: 5 * 60_000,
  });

  if (!pages || pages.length === 0) return null;

  return (
    <section className="py-10">
      <div className="max-w-2xl mx-auto px-4 sm:px-6">
        <div className="flex items-center gap-2 mb-4">
          <MapPin className="h-4 w-4 text-[hsl(var(--marketing-blue))]" />
          <p className="text-xs font-medium uppercase tracking-wider text-[hsl(var(--marketing-navy)/0.4)]">
            {t('civicSignalBlock.label')}
          </p>
        </div>
        <div className="space-y-3">
          {pages.map((p: any) => (
            <div
              key={p.slug}
              className="rounded-xl bg-[hsl(var(--marketing-surface))] px-5 py-4"
            >
              <p className="text-xs font-medium text-[hsl(var(--marketing-navy)/0.5)] mb-1">
                {p.display_name}
              </p>
              <p className="text-sm text-[hsl(var(--marketing-navy)/0.65)] leading-relaxed" style={serif}>
                {p.momentum_summary || t('civicSignalBlock.fallback')}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
