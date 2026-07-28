/**
 * LumenPulseCard — Nexus landing summary for Lumen signals.
 *
 * WHAT: Shows a brief narrative of emerging Lumen signals this week.
 * WHERE: /operator/nexus home page.
 * WHY: Gives the operator a quiet glance at what is forming.
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Compass, ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { buildLumenSummary } from '@/lib/operator/buildLumenNarrative';

export function LumenPulseCard() {
  const { data: signals } = useQuery({
    queryKey: ['lumen-pulse-summary'],
    queryFn: async () => {
      const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString();
      const { data } = await supabase
        .from('lumen_signals')
        .select('signal_type, severity, confidence, source_summary')
        .eq('resolved', false)
        .gte('last_updated_at', sevenDaysAgo)
        .order('last_updated_at', { ascending: false })
        .limit(20);
      return (data || []) as any[];
    },
  });

  const summary = buildLumenSummary(signals || []);

  return (
    <Link to="/operator/nexus/lumen" className="block group">
      <Card className="hover:border-primary/20 transition-colors">
        <CardContent className="pt-4 pb-3 flex items-start gap-3">
          <div className="p-1.5 rounded-lg bg-muted shrink-0 mt-0.5">
            <Compass className="w-4 h-4 text-foreground" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-semibold text-foreground font-serif">Lumen — Early Signals</p>
              <ChevronRight className="w-3.5 h-3.5 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
            </div>
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{summary}</p>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
