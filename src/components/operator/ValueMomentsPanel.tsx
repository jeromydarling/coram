import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { useValueMoments } from '@/hooks/useOperatorAdoption';
import { formatDistanceToNow } from 'date-fns';

const typeLabels: Record<string, string> = {
  nri_action_taken: 'NRI Action',
  reconnection: 'Reconnection',
  partner_found: 'Partner Found',
  event_attended: 'Event Attended',
  volunteer_returned: 'Volunteer Returned',
  provisio_fulfilled: 'Provisio Fulfilled',
  migration_success: 'Migration Success',
};

const typeColors: Record<string, string> = {
  nri_action_taken: 'bg-primary/10 text-primary',
  reconnection: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  partner_found: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  event_attended: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  volunteer_returned: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
  provisio_fulfilled: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
  migration_success: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-300',
};

export function ValueMomentsPanel() {
  const { data, isLoading } = useValueMoments();
  const [filter, setFilter] = useState('all');

  if (isLoading) return <Skeleton className="h-48 w-full" />;

  const filtered = filter === 'all'
    ? data || []
    : (data || []).filter((m) => m.moment_type === filter);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Value Moments</CardTitle>
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            {Object.entries(typeLabels).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent>
        {filtered.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground py-6">
            No value moments recorded yet.
          </p>
        ) : (
          <div className="space-y-3 max-h-[400px] overflow-y-auto">
            {filtered.map((m) => (
              <div key={m.id} className="flex items-start gap-3 p-3 rounded-lg bg-muted/30">
                <Badge className={typeColors[m.moment_type] || ''} variant="outline">
                  {typeLabels[m.moment_type] || m.moment_type}
                </Badge>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-foreground">{m.summary}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {(m as any).tenants?.name || 'Unknown tenant'} ·{' '}
                    {formatDistanceToNow(new Date(m.occurred_at), { addSuffix: true })}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
