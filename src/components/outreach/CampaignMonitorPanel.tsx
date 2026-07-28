import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, CheckCircle2, XCircle, Clock, Users, Send, AlertTriangle, Download } from 'lucide-react';
import { useCampaignAudience } from '@/hooks/useCampaignAudience';
import { useCampaignEvents } from '@/hooks/useGmailCampaignSend';
import { QuotaHitBadge } from '@/components/outreach/SendGuardrails';
import { ResendCandidatesPanel } from '@/components/outreach/ResendCandidatesPanel';
import { BouncedContactsPanel } from '@/components/outreach/BouncedContactsPanel';
import { exportRecipientsCSV } from '@/lib/csvRecipientExport';
import type { EmailCampaign } from '@/hooks/useEmailCampaigns';
import { format } from 'date-fns';

const BOUNCE_CATEGORIES = ['bounce', 'invalid_address', 'provider_perm'];

interface CampaignMonitorPanelProps {
  campaignId: string;
  campaign: EmailCampaign;
}

const recipientStatusConfig: Record<string, { icon: React.ReactNode; label: string; className: string }> = {
  queued: { icon: <Clock className="h-3.5 w-3.5" />, label: 'Queued', className: 'text-muted-foreground' },
  sent: { icon: <CheckCircle2 className="h-3.5 w-3.5" />, label: 'Sent', className: 'text-green-600' },
  failed: { icon: <XCircle className="h-3.5 w-3.5" />, label: 'Failed', className: 'text-destructive' },
  skipped: { icon: <AlertTriangle className="h-3.5 w-3.5" />, label: 'Skipped', className: 'text-amber-600' },
  duplicate: { icon: <AlertTriangle className="h-3.5 w-3.5" />, label: 'Duplicate', className: 'text-amber-600' },
};

export function CampaignMonitorPanel({ campaignId, campaign }: CampaignMonitorPanelProps) {
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const { data: audience = [], isLoading: audienceLoading } = useCampaignAudience(campaignId);
  const { data: events = [], isLoading: eventsLoading } = useCampaignEvents(campaignId);

  const bouncedCount = audience.filter(
    (m) => m.status === 'failed' && m.failure_category && BOUNCE_CATEGORIES.includes(m.failure_category)
  ).length;

  const filteredAudience = statusFilter === 'bounced'
    ? audience.filter((m) => m.status === 'failed' && m.failure_category && BOUNCE_CATEGORIES.includes(m.failure_category))
    : statusFilter
      ? audience.filter((m) => m.status === statusFilter)
      : audience;

  const statusCounts = audience.reduce<Record<string, number>>((acc, m) => {
    acc[m.status] = (acc[m.status] || 0) + 1;
    return acc;
  }, {});

  const progressPct = campaign.audience_count > 0
    ? Math.round(((campaign.sent_count + campaign.failed_count) / campaign.audience_count) * 100)
    : 0;

  const handleExportCSV = () => {
    const toExport = statusFilter ? filteredAudience : audience;
    exportRecipientsCSV(
      toExport,
      `campaign-${campaignId.slice(0, 8)}-${statusFilter || 'all'}-recipients.csv`
    );
  };

  return (
    <div className="space-y-4">
      {/* Quota hit detection */}
      <QuotaHitBadge events={events as Array<{ event_type: string; meta?: unknown }>} />

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Progress & Stats */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Send className="h-5 w-5" />
                Send Progress
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <p className="text-2xl font-bold text-green-600">{campaign.sent_count}</p>
                  <p className="text-xs text-muted-foreground">Sent</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-destructive">{campaign.failed_count}</p>
                  <p className="text-xs text-muted-foreground">Failed</p>
                </div>
                <div>
                  <p className="text-2xl font-bold">{statusCounts.queued || 0}</p>
                  <p className="text-xs text-muted-foreground">Queued</p>
                </div>
              </div>

              <div className="w-full bg-muted rounded-full h-3">
                <div
                  className="bg-primary h-3 rounded-full transition-all duration-300"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
              <p className="text-sm text-muted-foreground text-center">
                {progressPct}% complete — {campaign.audience_count} total
              </p>

              {campaign.last_sent_at && (
                <p className="text-xs text-muted-foreground text-center">
                  Last send: {format(new Date(campaign.last_sent_at), 'MMM d, yyyy h:mm a')}
                </p>
              )}
            </CardContent>
          </Card>

          {/* Event Timeline */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Event Log</CardTitle>
            </CardHeader>
            <CardContent>
              {eventsLoading ? (
                <div className="flex justify-center py-4">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : events.length === 0 ? (
                <p className="text-sm text-muted-foreground">No events yet</p>
              ) : (
                <ScrollArea className="h-[300px]">
                  <div className="space-y-2">
                    {events.map((event) => (
                      <div key={event.id} className="flex gap-3 text-sm py-1.5 border-b last:border-0">
                        <span className="text-xs text-muted-foreground shrink-0 w-16">
                          {event.created_at ? format(new Date(event.created_at), 'HH:mm:ss') : ''}
                        </span>
                        <div className="min-w-0">
                          <Badge variant="outline" className="text-xs mr-2">{event.event_type}</Badge>
                          {event.message && (
                            <span className="text-muted-foreground truncate">{event.message}</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Recipient Status Table */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between flex-wrap gap-2">
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Recipients
              </CardTitle>
              <div className="flex items-center gap-2 flex-wrap">
                <div className="flex gap-1 flex-wrap">
                  <Badge
                    variant={statusFilter === null ? 'default' : 'outline'}
                    className="cursor-pointer text-xs"
                    onClick={() => setStatusFilter(null)}
                  >
                    All ({audience.length})
                  </Badge>
                  {Object.entries(statusCounts).map(([s, count]) => (
                    <Badge
                      key={s}
                      variant={statusFilter === s ? 'default' : 'outline'}
                      className="cursor-pointer text-xs"
                      onClick={() => setStatusFilter(s === statusFilter ? null : s)}
                    >
                      {s} ({count})
                    </Badge>
                  ))}
                  {bouncedCount > 0 && (
                    <Badge
                      variant={statusFilter === 'bounced' ? 'destructive' : 'outline'}
                      className="cursor-pointer text-xs"
                      onClick={() => setStatusFilter(statusFilter === 'bounced' ? null : 'bounced')}
                    >
                      Bounced ({bouncedCount})
                    </Badge>
                  )}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleExportCSV}
                  disabled={audience.length === 0}
                >
                  <Download className="h-3.5 w-3.5 mr-1" />
                  CSV
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {audienceLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : filteredAudience.length === 0 ? (
              <p className="text-center py-8 text-muted-foreground">No recipients match filter</p>
            ) : (
              <ScrollArea className="h-[500px]">
                <div className="space-y-1">
                  {filteredAudience.map((member) => {
                    const config = recipientStatusConfig[member.status] || recipientStatusConfig.queued;
                    return (
                      <div key={member.id} className="flex items-center gap-3 p-2 rounded hover:bg-accent">
                        <span className={config.className}>{config.icon}</span>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate text-sm">
                            {member.name || member.email}
                          </p>
                          {member.name && (
                            <p className="text-xs text-muted-foreground truncate">{member.email}</p>
                          )}
                        </div>
                        <Badge variant="outline" className="text-xs shrink-0">
                          {config.label}
                        </Badge>
                        {member.error_message && (
                          <span className="text-xs text-destructive truncate max-w-[120px]" title={member.error_message}>
                            {member.error_message}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Bounce Detection */}
      <BouncedContactsPanel campaignId={campaignId} audience={audience} />

      {/* B3: Resend Candidates */}
      {campaign.failed_count > 0 && (
        <ResendCandidatesPanel campaignId={campaignId} campaign={campaign} />
      )}
    </div>
  );
}
