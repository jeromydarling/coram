/**
 * DriftDetectionSection — Gentle relationship drift awareness.
 *
 * WHAT: Shows which relationships have gone quiet, sorted by silence duration.
 * WHERE: Testimonium page, Drift Detection tab.
 * WHY: Helps stewards notice and reconnect without urgency or alarm.
 */

import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { HelpTooltip } from '@/components/ui/help-tooltip';
import { Eye, Clock, Users, Heart } from 'lucide-react';
import { useRelationshipDrift, type DriftStatus, type RelationshipDriftItem } from '@/hooks/useRelationshipDrift';
import { useTenantPath } from '@/hooks/useTenantPath';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';

const statusConfig: Record<DriftStatus, { label: string; color: string; icon: typeof Eye }> = {
  present: { label: 'Present', color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300', icon: Heart },
  quiet: { label: 'Quiet', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300', icon: Clock },
  drifting: { label: 'Drifting', color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300', icon: Eye },
  distant: { label: 'Distant', color: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300', icon: Eye },
};

function DriftCard({ item }: { item: RelationshipDriftItem }) {
  const navigate = useNavigate();
  const { tenantPath } = useTenantPath();
  const config = statusConfig[item.driftStatus];
  const Icon = config.icon;

  return (
    <Card
      className="cursor-pointer hover:shadow-md transition-shadow rounded-xl border-border/50"
      onClick={() => navigate(tenantPath(`/opportunity/${item.opportunityId}`))}
    >
      <CardContent className="py-4 px-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1 space-y-1.5">
            <h4 className="text-sm font-medium text-foreground truncate">
              {item.name}
            </h4>
            <p className="text-xs text-muted-foreground">
              {item.lastActivityDate
                ? `Last seen ${format(new Date(item.lastActivityDate), 'MMM d, yyyy')} · ${item.lastActivityType?.replace(/_/g, ' ')}`
                : 'No recorded interactions yet'}
            </p>
            {item.contactCount > 0 && (
              <p className="text-xs text-muted-foreground/70 flex items-center gap-1">
                <Users className="w-3 h-3" />
                {item.contactCount} interaction{item.contactCount !== 1 ? 's' : ''} total
              </p>
            )}
          </div>
          <div className="flex flex-col items-end gap-1.5 shrink-0">
            <Badge variant="secondary" className={`text-xs font-normal ${config.color}`}>
              <Icon className="w-3 h-3 mr-1" />
              {config.label}
            </Badge>
            <span className="text-xs text-muted-foreground tabular-nums">
              {item.daysSinceContact >= 999
                ? 'Never contacted'
                : `${item.daysSinceContact}d ago`}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function DriftDetectionSection() {
  const { data: items, isLoading } = useRelationshipDrift();

  const needsAttention = items?.filter(i => i.driftStatus !== 'present') ?? [];
  const present = items?.filter(i => i.driftStatus === 'present') ?? [];

  if (isLoading) {
    return (
      <div className="space-y-4 max-w-3xl">
        {[1, 2, 3, 4].map(i => (
          <Skeleton key={i} className="h-20 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Intro */}
      <div className="flex items-start gap-3">
        <p className="text-sm text-muted-foreground leading-relaxed">
          These are relationships that may benefit from a moment of reconnection.
          Not an alarm — just a gentle noticing.
        </p>
        <HelpTooltip content="Drift Detection looks at your last interaction with each partner. Relationships quiet for more than 14 days appear here as an invitation to check in — never as a warning." />
      </div>

      {/* Needs attention */}
      {needsAttention.length > 0 ? (
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-foreground/80">
            You may want to check in
          </h3>
          {needsAttention.map(item => (
            <DriftCard key={item.opportunityId} item={item} />
          ))}
        </div>
      ) : (
        <Card className="rounded-xl border-dashed">
          <CardContent className="py-10 text-center">
            <Heart className="w-10 h-10 mx-auto text-primary/60 mb-3" />
            <h3 className="text-lg font-serif font-medium text-foreground mb-1">
              All relationships are present
            </h3>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              Every partner has been contacted recently. Nothing needs attention right now.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Present relationships (collapsed summary) */}
      {present.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-muted-foreground/70">
            Present · {present.length} relationship{present.length !== 1 ? 's' : ''} recently active
          </h3>
          <div className="flex flex-wrap gap-2">
            {present.map(item => (
              <Badge key={item.opportunityId} variant="outline" className="text-xs font-normal">
                {item.name}
              </Badge>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
