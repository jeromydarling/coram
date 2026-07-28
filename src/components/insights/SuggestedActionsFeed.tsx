import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Loader2,
  Zap,
  Check,
  X,
  Search,
  AlertTriangle,
  TrendingUp,
  Lightbulb,
} from 'lucide-react';
import { useDashboardActions, useUpdateActionStatus, useExecuteAction } from '@/hooks/useOrgInsights';
import { useActionOutcomes } from '@/hooks/useActionOutcomes';
import { ActionOutcomeFeedback } from './ActionOutcomeFeedback';
import { formatDistanceToNow } from 'date-fns';
import { Skeleton } from '@/components/ui/skeleton';
import { useNavigate } from 'react-router-dom';

const SEVERITY_STYLES: Record<string, string> = {
  low: 'bg-info/15 text-info',
  medium: 'bg-warning/15 text-warning',
  high: 'bg-destructive/15 text-destructive',
};

const INSIGHT_ICONS: Record<string, typeof TrendingUp> = {
  momentum_increase: TrendingUp,
  community_need_alignment: Lightbulb,
  instability_risk: AlertTriangle,
};

export function SuggestedActionsFeed() {
  const { data: actions, isLoading } = useDashboardActions(50);
  const updateAction = useUpdateActionStatus();
  const executeAction = useExecuteAction();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [severityFilter, setSeverityFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');

  const filtered = useMemo(() => {
    if (!actions) return [];
    return actions.filter((a) => {
      const insight = a.org_insights;
      if (severityFilter !== 'all' && insight.severity !== severityFilter) return false;
      if (typeFilter !== 'all' && a.action_type !== typeFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        if (
          !a.title.toLowerCase().includes(q) &&
          !a.description.toLowerCase().includes(q) &&
          !insight.title.toLowerCase().includes(q)
        ) return false;
      }
      return true;
    });
  }, [actions, search, severityFilter, typeFilter]);

  const actionTypes = useMemo(() => {
    if (!actions) return [];
    return [...new Set(actions.map((a) => a.action_type))];
  }, [actions]);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Zap className="w-4 h-4 text-primary" />
            Suggested Actions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-20 rounded-lg" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Zap className="w-4 h-4 text-primary" />
          Suggested Actions
          {actions && actions.length > 0 && (
            <Badge variant="secondary" className="ml-auto text-xs">{actions.length} open</Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Filters */}
        <div className="flex flex-wrap gap-2">
          <div className="relative flex-1 min-w-[140px]">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Search actions…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-8 pl-8 text-xs"
            />
          </div>
          <Select value={severityFilter} onValueChange={setSeverityFilter}>
            <SelectTrigger className="h-8 w-[110px] text-xs">
              <SelectValue placeholder="Severity" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All severity</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="low">Low</SelectItem>
            </SelectContent>
          </Select>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="h-8 w-[140px] text-xs">
              <SelectValue placeholder="Action type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              {actionTypes.map((t) => (
                <SelectItem key={t} value={t}>
                  {t.replace(/_/g, ' ')}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Actions list */}
        {filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            No open actions found.
          </p>
        ) : (
          <div className="space-y-2 max-h-[400px] overflow-y-auto">
            {filtered.map((action) => {
              const insight = action.org_insights;
              const Icon = INSIGHT_ICONS[insight.insight_type] || Lightbulb;
              return (
                <div
                  key={action.id}
                  className="flex items-start gap-3 p-3 rounded-lg border bg-card hover:bg-muted/30 transition-colors"
                >
                  <Icon className="w-4 h-4 mt-0.5 text-primary shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{action.title}</p>
                    <p className="text-xs text-muted-foreground line-clamp-1">{action.description}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge className={`text-xs ${SEVERITY_STYLES[insight.severity]}`}>
                        {insight.severity}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(action.created_at))} ago
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 w-7 p-0"
                      title="Execute"
                      disabled={executeAction.isPending || updateAction.isPending}
                      onClick={() =>
                        executeAction.mutate(
                          { actionId: action.id },
                          {
                            onSuccess: (data) => {
                              if (data.navigate_to) {
                                navigate(data.navigate_to);
                              }
                            },
                          },
                        )
                      }
                    >
                      {executeAction.isPending ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Check className="w-3.5 h-3.5" />
                      )}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 w-7 p-0"
                      title="Dismiss"
                      disabled={updateAction.isPending}
                      onClick={() =>
                        updateAction.mutate({
                          actionId: action.id,
                          status: 'dismissed',
                          orgId: action.org_id,
                          actionType: action.action_type,
                        })
                      }
                    >
                      <X className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
