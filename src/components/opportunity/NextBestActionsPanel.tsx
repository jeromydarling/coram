import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Zap, MoreHorizontal, Check, X, Clock, Loader2, Mail, Calendar, Building2, Eye } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useOrgNextActions, useUpdateNextAction, type NextAction } from '@/hooks/useNextActions';
import { addDays } from 'date-fns';
import { useTenantNavigate } from '@/hooks/useTenantPath';

const ACTION_TYPE_ICONS: Record<string, typeof Mail> = {
  email_intro: Mail,
  follow_up: Zap,
  event_outreach: Calendar,
  grant_followup: Building2,
  strategic_outreach: Zap,
};

const ACTION_TYPE_LABELS: Record<string, string> = {
  email_intro: 'Email Intro',
  follow_up: 'Follow Up',
  event_outreach: 'Event Outreach',
  grant_followup: 'Grant Follow-up',
  strategic_outreach: 'Strategic Outreach',
};

function confidenceBadge(confidence: number) {
  if (confidence >= 0.8) return { label: 'High', className: 'bg-destructive/15 text-destructive' };
  if (confidence >= 0.6) return { label: 'Medium', className: 'bg-warning/15 text-warning' };
  return { label: 'Low', className: 'bg-muted text-muted-foreground' };
}

function ActionItem({ action }: { action: NextAction }) {
  const navigate = useTenantNavigate();
  const update = useUpdateNextAction();
  const badge = confidenceBadge(action.confidence);
  const Icon = ACTION_TYPE_ICONS[action.action_type] || Zap;

  return (
    <div className="flex items-start gap-3 p-3 rounded-lg border bg-card hover:bg-accent/30 transition-colors">
      <div className="p-1.5 rounded bg-primary/10 mt-0.5">
        <Icon className="w-3.5 h-3.5 text-primary" />
      </div>
      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-foreground truncate">{action.summary}</span>
          <Badge className={cn('text-[10px] shrink-0', badge.className)}>{badge.label}</Badge>
        </div>
        <p className="text-xs text-muted-foreground line-clamp-2">
          {ACTION_TYPE_LABELS[action.action_type] || action.action_type} • Score: {action.score.toFixed(1)}
        </p>
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0 shrink-0">
            {update.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <MoreHorizontal className="w-3.5 h-3.5" />}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => navigate(`/opportunities/${action.org_id}`)}>
            <Eye className="w-3.5 h-3.5 mr-2" /> View Org
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => update.mutate({ id: action.id, status: 'executed' })}>
            <Check className="w-3.5 h-3.5 mr-2" /> Mark Done
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => update.mutate({ id: action.id, status: 'dismissed' })}>
            <X className="w-3.5 h-3.5 mr-2" /> Dismiss
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() =>
              update.mutate({
                id: action.id,
                status: 'snoozed',
                snoozed_until: addDays(new Date(), 7).toISOString(),
              })
            }
          >
            <Clock className="w-3.5 h-3.5 mr-2" /> Snooze 7d
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

interface NextBestActionsPanelProps {
  orgId: string;
}

export function NextBestActionsPanel({ orgId }: NextBestActionsPanelProps) {
  const { data: actions, isLoading } = useOrgNextActions(orgId);

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Zap className="w-4 h-4 text-primary" /> Next Best Actions
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
        </CardContent>
      </Card>
    );
  }

  // Only show open actions
  const openActions = (actions || []).filter(a => a.status === 'open');

  if (openActions.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Zap className="w-4 h-4 text-primary" />
              Next Best Actions
            </CardTitle>
            <CardDescription className="text-xs">Suggested actions based on signals & activity</CardDescription>
          </div>
          <Badge variant="secondary" className="text-xs">{openActions.length}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {openActions.map((action) => (
          <ActionItem key={action.id} action={action} />
        ))}
      </CardContent>
    </Card>
  );
}
