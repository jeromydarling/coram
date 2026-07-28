/**
 * NarrativePulseStrip — Rotating anonymized civic signals from the network.
 *
 * WHAT: Displays anonymized narrative signals from testimonium_rollups.
 * WHERE: Marketing pages — landing, archetypes, metros.
 * WHY: Living proof the platform breathes — no tenant names, no PII.
 */
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useEffect, useState } from 'react';
import { Radio } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const serif = { fontFamily: 'Georgia, "Times New Roman", serif' };

export default function NarrativePulseStrip() {
  const { t } = useTranslation('marketing');
  const [currentIndex, setCurrentIndex] = useState(0);

  // Anonymized templates — fill from rollup counts
  const signalTemplates = [
    (n: number) => t('narrativePulseStrip.signal1', { n }),
    (n: number) => t('narrativePulseStrip.signal2', { n }),
    (n: number) => t('narrativePulseStrip.signal3', { n }),
    (n: number) => t('narrativePulseStrip.signal4', { n }),
    (n: number) => t('narrativePulseStrip.signal5', { n }),
  ];

  const { data: signals } = useQuery({
    queryKey: ['narrative-pulse-strip'],
    queryFn: async () => {
      // Pull aggregated counts from testimonium_rollups (no PII)
      const { data } = await supabase
        .from('testimonium_rollups')
        .select('period_start, event_count, tenant_id')
        .order('period_start', { ascending: false })
        .limit(50);

      if (!data || data.length === 0) return [];

      const totalEvents = data.reduce((sum: number, r: any) => sum + (r.event_count || 0), 0);
      const uniqueTenants = new Set(data.map((r: any) => r.tenant_id)).size;

      // Generate anonymized signals from aggregated data
      return signalTemplates.map((fn) => {
        const n = Math.max(1, Math.min(totalEvents, uniqueTenants * 3));
        return fn(n);
      });
    },
    staleTime: 10 * 60_000,
  });

  // Rotate signals every 6 seconds
  useEffect(() => {
    if (!signals || signals.length === 0) return;
    const timer = setInterval(() => {
      setCurrentIndex((i) => (i + 1) % signals.length);
    }, 6000);
    return () => clearInterval(timer);
  }, [signals]);

  if (!signals || signals.length === 0) return null;

  return (
    <div className="py-6">
      <div className="max-w-2xl mx-auto px-4 sm:px-6">
        <div className="flex items-start gap-3 rounded-xl bg-[hsl(var(--marketing-surface))] px-5 py-4">
          <Radio className="h-4 w-4 text-[hsl(var(--marketing-blue))] mt-0.5 shrink-0 animate-pulse" />
          <p
            className="text-sm text-[hsl(var(--marketing-navy)/0.6)] leading-relaxed transition-opacity duration-700"
            style={serif}
            key={currentIndex}
          >
            {signals[currentIndex]}
          </p>
        </div>
      </div>
    </div>
  );
}
