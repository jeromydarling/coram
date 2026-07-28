import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useOrgActionHistory, type OrgActionHistory } from '@/hooks/useLearningDashboard';
import { History, CheckCircle2, XCircle, Clock, Mail, MessageSquare } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';

function outcomeIcon(type: string | null) {
  switch (type) {
    case 'reply': return <MessageSquare className="w-3.5 h-3.5 text-success" />;
    case 'meeting': return <CheckCircle2 className="w-3.5 h-3.5 text-primary" />;
    case 'bounce': return <XCircle className="w-3.5 h-3.5 text-destructive" />;
    case 'ignore': return <Clock className="w-3.5 h-3.5 text-muted-foreground" />;
    default: return <Mail className="w-3.5 h-3.5 text-muted-foreground" />;
  }
}

function outcomeBadge(type: string | null) {
  if (!type) return null;
  const styles: Record<string, string> = {
    reply: 'bg-success/15 text-success',
    meeting: 'bg-primary/15 text-primary',
    click: 'bg-info/15 text-info',
    bounce: 'bg-destructive/15 text-destructive',
    ignore: 'bg-muted text-muted-foreground',
    unsubscribe: 'bg-destructive/15 text-destructive',
  };
  return (
    <Badge className={cn('text-[10px]', styles[type] || 'bg-muted text-muted-foreground')}>
      {type}
    </Badge>
  );
}

// Dedupe timeline entries by action_id, combining outcomes
function dedupeTimeline(rows: OrgActionHistory[]) {
  const map = new Map<string, {
    action: OrgActionHistory;
    outcomes: { type: string; observed_at: string | null; confidence: number | null }[];
  }>();

  for (const r of rows) {
    const existing = map.get(r.action_id);
    if (existing) {
      if (r.outcome_type) {
        existing.outcomes.push({
          type: r.outcome_type,
          observed_at: r.observed_at,
          confidence: r.outcome_confidence,
        });
      }
    } else {
      map.set(r.action_id, {
        action: r,
        outcomes: r.outcome_type
          ? [{ type: r.outcome_type, observed_at: r.observed_at, confidence: r.outcome_confidence }]
          : [],
      });
    }
  }

  return Array.from(map.values());
}

export function OrgActionTimeline({ orgId }: { orgId: string }) {
  const { data: history, isLoading } = useOrgActionHistory(orgId);

  const entries = history ? dedupeTimeline(history) : [];

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <History className="w-4 h-4" /> Actions Timeline
          </CardTitle>
        </CardHeader>
        <CardContent>
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-12 w-full mb-2" />)}
        </CardContent>
      </Card>
    );
  }

  if (entries.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <History className="w-4 h-4" /> Actions Timeline
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-4">No actions recorded yet</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <History className="w-4 h-4" /> Actions Timeline
          </CardTitle>
          <Badge variant="secondary" className="text-xs">{entries.length}</Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {entries.slice(0, 15).map(({ action, outcomes }) => (
            <div key={action.action_id} className="flex gap-3 items-start">
              <div className="mt-1 flex-shrink-0">
                {outcomes.length > 0 ? outcomeIcon(outcomes[0].type) : <Mail className="w-3.5 h-3.5 text-muted-foreground" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{action.action_summary || action.action_type}</p>
                <div className="flex items-center gap-2 flex-wrap mt-0.5">
                  <Badge variant="outline" className="text-[10px]">{action.source}</Badge>
                  <Badge
                    className={cn(
                      'text-[10px]',
                      action.action_status === 'executed'
                        ? 'bg-success/15 text-success'
                        : action.action_status === 'aborted'
                        ? 'bg-destructive/15 text-destructive'
                        : 'bg-muted text-muted-foreground'
                    )}
                  >
                    {action.action_status}
                  </Badge>
                  {outcomes.map((o, i) => (
                    <span key={i}>{outcomeBadge(o.type)}</span>
                  ))}
                </div>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  {format(parseISO(action.action_created_at), 'MMM d, yyyy')}
                  {action.executed_at && ` • Executed ${format(parseISO(action.executed_at), 'MMM d')}`}
                </p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
