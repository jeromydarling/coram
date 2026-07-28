import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import { useCampaignAudience } from '@/hooks/useCampaignAudience';

const CATEGORY_LABELS: Record<string, string> = {
  quota: 'Quota / Rate Limit',
  invalid_address: 'Invalid Address',
  bounce: 'Bounce',
  provider_temp: 'Temporary Error',
  provider_perm: 'Permanent Error',
  unknown: 'Unknown',
};

const CATEGORY_COLORS: Record<string, string> = {
  quota: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
  invalid_address: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  bounce: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  provider_temp: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
  provider_perm: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  unknown: 'bg-muted text-muted-foreground',
};

interface FailureBreakdownPanelProps {
  campaignId: string;
}

export function FailureBreakdownPanel({ campaignId }: FailureBreakdownPanelProps) {
  const { data: audience = [] } = useCampaignAudience(campaignId);

  const failedRows = audience.filter((m) => m.status === 'failed');

  // Count by failure_category
  const categoryCounts = failedRows.reduce<Record<string, number>>((acc, m) => {
    const cat = ((m as unknown as Record<string, unknown>).failure_category as string) || 'unknown';
    acc[cat] = (acc[cat] || 0) + 1;
    return acc;
  }, {});

  // Top raw errors
  const rawErrors = failedRows.reduce<Record<string, number>>((acc, m) => {
    const raw = m.error_message || 'Unknown error';
    // Group by first 80 chars
    const key = raw.slice(0, 80);
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

  const topErrors = Object.entries(rawErrors)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 8);

  if (failedRows.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            Failure Breakdown
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-6 text-muted-foreground">
            <CheckCircle2 className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>No failures recorded</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <AlertTriangle className="h-5 w-5" />
          Failure Breakdown ({failedRows.length} total)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Category counts */}
        <div className="flex flex-wrap gap-2">
          {Object.entries(categoryCounts)
            .sort(([, a], [, b]) => b - a)
            .map(([cat, count]) => (
              <Badge
                key={cat}
                variant="outline"
                className={CATEGORY_COLORS[cat] || CATEGORY_COLORS.unknown}
              >
                {CATEGORY_LABELS[cat] || cat}: {count}
              </Badge>
            ))}
        </div>

        {/* Top raw errors */}
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-2">Top Error Messages</p>
          <ScrollArea className="h-[180px]">
            <div className="space-y-1.5">
              {topErrors.map(([reason, count]) => (
                <div
                  key={reason}
                  className="flex items-center justify-between p-2 rounded bg-muted/30 text-sm"
                >
                  <span className="truncate max-w-[250px]" title={reason}>
                    {reason}
                  </span>
                  <Badge variant="destructive" className="shrink-0 ml-2">
                    {count}
                  </Badge>
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>
      </CardContent>
    </Card>
  );
}
