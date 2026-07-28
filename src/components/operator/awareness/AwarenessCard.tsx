/**
 * AwarenessCard — A calm, narrative-driven signal card for the operator.
 *
 * WHAT: Displays a single awareness event with warm styling and no urgency.
 * WHERE: OperatorAwarenessPanel on /operator/nexus
 * WHY: Operators should receive signals as gentle narrative, not alerts.
 */
import { Card, CardContent } from '@/components/ui/card';
import { CalmNarrativeBadge } from './CalmNarrativeBadge';
import { ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';

export interface AwarenessEvent {
  id: string;
  category: string;
  title: string;
  summary: string;
  signal_strength: number;
  tenant_id?: string | null;
  metro_id?: string | null;
  source: string;
  created_at: string;
  resolved: boolean;
}

const CATEGORY_ROUTES: Record<string, string> = {
  activation: '/operator/nexus/activation',
  migration: '/operator/nexus/migrations',
  expansion: '/operator/nexus/expansion',
  narrative: '/operator/testimonium',
  friction: '/operator/nexus/friction',
  growth: '/operator/nexus/presence',
};

export function AwarenessCard({ event }: { event: AwarenessEvent }) {
  const to = CATEGORY_ROUTES[event.category] || '/operator/nexus';

  return (
    <Link to={to} className="block group">
      <Card className="hover:border-primary/20 transition-colors border-border/60">
        <CardContent className="pt-4 pb-3 flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-1">
              <CalmNarrativeBadge category={event.category} />
              {event.signal_strength >= 3 && (
                <span className="text-[10px] text-muted-foreground/70 uppercase tracking-wider">strong signal</span>
              )}
            </div>
            <p className="text-sm font-medium text-foreground font-serif leading-snug">
              {event.title}
            </p>
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
              {event.summary}
            </p>
          </div>
          <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/50 group-hover:text-primary transition-colors mt-1 shrink-0" />
        </CardContent>
      </Card>
    </Link>
  );
}
