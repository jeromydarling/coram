import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Lightbulb, Mail, Clock, X } from 'lucide-react';
import { useFollowUpSuggestions, useFollowUpAction } from '@/hooks/useFollowUpSuggestions';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { format, parseISO } from 'date-fns';

interface FollowUpSuggestionsCardProps {
  orgId?: string;
  compact?: boolean;
}

const sourceLabels: Record<string, string> = {
  reply: 'Reply received',
  watchlist: 'Watchlist signal',
  event: 'Event import',
};

export function FollowUpSuggestionsCard({ orgId, compact = false }: FollowUpSuggestionsCardProps) {
  const [statusFilter, setStatusFilter] = useState('pending');
  const { data: suggestions, isLoading } = useFollowUpSuggestions({
    orgId,
    status: statusFilter,
    limit: compact ? 10 : 50,
  });
  const action = useFollowUpAction();
  const { hasAnyRole } = useAuth();
  const navigate = useNavigate();

  const canAct = hasAnyRole(['admin', 'regional_lead', 'staff']);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <Lightbulb className="w-4 h-4 text-primary" />
            Follow-Up Suggestions
            <Badge variant="secondary" className="ml-1 text-xs">{suggestions?.length || 0}</Badge>
          </CardTitle>
          {!compact && (
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[110px] h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="accepted">Accepted</SelectItem>
                <SelectItem value="dismissed">Dismissed</SelectItem>
                <SelectItem value="snoozed">Snoozed</SelectItem>
                <SelectItem value="all">All</SelectItem>
              </SelectContent>
            </Select>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : !suggestions?.length ? (
          <p className="text-sm text-muted-foreground text-center py-6">
            No follow-up suggestions
          </p>
        ) : (
          <div className="space-y-2 max-h-[400px] overflow-y-auto">
            {suggestions.map((s) => (
              <div key={s.id} className="border rounded-lg p-3 space-y-1.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{s.reason}</p>
                    <div className="flex gap-1.5 mt-1">
                      <Badge variant="outline" className="text-xs">
                        {sourceLabels[s.source_type] || s.source_type}
                      </Badge>
                      {s.suggested_template_key && (
                        <Badge variant="secondary" className="text-xs">
                          {s.suggested_template_key}
                        </Badge>
                      )}
                    </div>
                  </div>
                  <Badge
                    variant={s.status === 'pending' ? 'default' : 'secondary'}
                    className="text-xs shrink-0"
                  >
                    {s.status}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  {format(parseISO(s.created_at), 'MMM d, yyyy')}
                </p>
                {canAct && s.status === 'pending' && (
                  <div className="flex gap-1.5 pt-1">
                    <Button
                      size="sm"
                      variant="default"
                      className="h-7 text-xs gap-1"
                      disabled={action.isPending}
                      onClick={() => {
                        action.mutate({ id: s.id, action: 'accept' });
                        navigate('/outreach/campaigns/new');
                      }}
                    >
                      <Mail className="w-3 h-3" />
                      Create Draft
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 text-xs gap-1"
                      disabled={action.isPending}
                      onClick={() => action.mutate({ id: s.id, action: 'snooze', days: 7 })}
                    >
                      <Clock className="w-3 h-3" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 text-xs gap-1 text-muted-foreground"
                      disabled={action.isPending}
                      onClick={() => action.mutate({ id: s.id, action: 'dismiss' })}
                    >
                      <X className="w-3 h-3" />
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
