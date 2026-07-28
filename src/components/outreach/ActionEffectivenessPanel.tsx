import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Loader2, TrendingUp } from 'lucide-react';
import { useActionEffectiveness, type ActionEffectiveness } from '@/hooks/useCampaignIntelligence';

interface ActionEffectivenessPanelProps {
  orgId?: string;
}

export function ActionEffectivenessPanel({ orgId }: ActionEffectivenessPanelProps) {
  const { data: rows, isLoading } = useActionEffectiveness(orgId);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex justify-center py-8">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  const sorted = [...(rows || [])].sort((a, b) => b.success_rate - a.success_rate);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm">
          <TrendingUp className="h-4 w-4 text-primary" />
          Action Effectiveness (Last 90 Days)
        </CardTitle>
      </CardHeader>
      <CardContent>
        {!sorted.length ? (
          <p className="text-sm text-muted-foreground text-center py-6">
            No effectiveness data yet. Send campaigns to build history.
          </p>
        ) : (
          <div className="space-y-3">
            {sorted.map((row, i) => (
              <EffectivenessRow key={i} row={row} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function EffectivenessRow({ row }: { row: ActionEffectiveness }) {
  const pct = Math.round(row.success_rate * 100);
  const variant = pct >= 50 ? 'default' : pct >= 15 ? 'secondary' : 'destructive';

  return (
    <div className="border rounded-lg p-3 space-y-2">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium">{formatActionType(row.action_type)}</p>
          <p className="text-xs text-muted-foreground">
            {row.total_actions} actions · {row.successful_actions} successful · Source: {row.source}
          </p>
        </div>
        <Badge variant={variant}>{pct}%</Badge>
      </div>
      <Progress value={pct} className="h-1.5" />
    </div>
  );
}

function formatActionType(type: string): string {
  return type
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
