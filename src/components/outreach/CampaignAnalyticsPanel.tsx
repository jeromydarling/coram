import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { BarChart3, Clock, CheckCircle2, XCircle, AlertTriangle, Users } from 'lucide-react';
import { useCampaignAudience } from '@/hooks/useCampaignAudience';
import { useCampaignEvents } from '@/hooks/useGmailCampaignSend';
import { SubjectPerformanceTable } from '@/components/outreach/SubjectPerformanceTable';
import { FailureBreakdownPanel } from '@/components/outreach/FailureBreakdownPanel';
import type { EmailCampaign } from '@/hooks/useEmailCampaigns';

interface CampaignAnalyticsPanelProps {
  campaignId: string;
  campaign: EmailCampaign;
}

export function CampaignAnalyticsPanel({ campaignId, campaign }: CampaignAnalyticsPanelProps) {
  const { data: audience = [] } = useCampaignAudience(campaignId);
  const { data: events = [] } = useCampaignEvents(campaignId);

  // Compute skipped count
  const skippedCount = audience.filter(
    (m) => m.status === 'skipped' || m.status === 'duplicate'
  ).length;

  // Compute completion time
  const sendStarted = events.find((e) => e.event_type === 'send_started');
  const sendFinished = events.find(
    (e) => e.event_type === 'send_finished' || e.event_type === 'send_failed'
  );

  let completionTimeStr = '—';
  if (sendStarted?.created_at && sendFinished?.created_at) {
    const ms =
      new Date(sendFinished.created_at).getTime() -
      new Date(sendStarted.created_at).getTime();
    if (ms < 60000) {
      completionTimeStr = `${Math.round(ms / 1000)}s`;
    } else {
      completionTimeStr = `${Math.round(ms / 60000)}m ${Math.round((ms % 60000) / 1000)}s`;
    }
  }

  // Failure reason distribution (legacy - from error_message)
  const failureReasons = audience
    .filter((m) => m.status === 'failed' && m.error_message)
    .reduce<Record<string, number>>((acc, m) => {
      const reason = m.error_message || 'Unknown';
      acc[reason] = (acc[reason] || 0) + 1;
      return acc;
    }, {});

  const topFailures = Object.entries(failureReasons)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5);

  return (
    <div className="space-y-6">
      {/* Rollup stats + legacy failure reasons */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Rollup Stats */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Campaign Rollup
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center p-3 rounded-lg bg-muted/50">
                <Users className="h-5 w-5 mx-auto mb-1 text-muted-foreground" />
                <p className="text-2xl font-bold">{campaign.audience_count}</p>
                <p className="text-xs text-muted-foreground">Total Audience</p>
              </div>
              <div className="text-center p-3 rounded-lg bg-muted/50">
                <CheckCircle2 className="h-5 w-5 mx-auto mb-1 text-green-600" />
                <p className="text-2xl font-bold text-green-600">{campaign.sent_count}</p>
                <p className="text-xs text-muted-foreground">Sent</p>
              </div>
              <div className="text-center p-3 rounded-lg bg-muted/50">
                <XCircle className="h-5 w-5 mx-auto mb-1 text-destructive" />
                <p className="text-2xl font-bold text-destructive">{campaign.failed_count}</p>
                <p className="text-xs text-muted-foreground">Failed</p>
              </div>
              <div className="text-center p-3 rounded-lg bg-muted/50">
                <AlertTriangle className="h-5 w-5 mx-auto mb-1 text-amber-600" />
                <p className="text-2xl font-bold text-amber-600">{skippedCount}</p>
                <p className="text-xs text-muted-foreground">Skipped</p>
              </div>
            </div>

            <div className="mt-4 p-3 rounded-lg border">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock className="h-4 w-4" />
                <span>Completion Time</span>
              </div>
              <p className="text-lg font-semibold mt-1">{completionTimeStr}</p>
            </div>
          </CardContent>
        </Card>

        {/* Failure Breakdown (B2 - categorized) */}
        <FailureBreakdownPanel campaignId={campaignId} />
      </div>

      {/* B1: Subject Performance */}
      <SubjectPerformanceTable />

      {/* Legacy failure reasons (if no categories yet) */}
      {topFailures.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Raw Error Messages</CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[200px]">
              <div className="space-y-2">
                {topFailures.map(([reason, count]) => (
                  <div
                    key={reason}
                    className="flex items-center justify-between p-2 rounded bg-muted/30"
                  >
                    <span className="text-sm truncate max-w-[200px]" title={reason}>
                      {reason}
                    </span>
                    <Badge variant="destructive" className="shrink-0">
                      {count}
                    </Badge>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}
    </div>
  );
}