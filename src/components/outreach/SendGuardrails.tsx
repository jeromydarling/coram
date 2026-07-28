import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertTriangle, Info, Shield } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ChevronDown } from 'lucide-react';
import type { EmailCampaign } from '@/hooks/useEmailCampaigns';
import type { CampaignAudienceMember } from '@/hooks/useCampaignAudience';

interface SendGuardrailsProps {
  campaign: EmailCampaign;
  audience: CampaignAudienceMember[];
  gmailConnected: boolean;
  htmlBody: string;
  subject: string;
}

interface SendBlocker {
  message: string;
  severity: 'error' | 'warning';
}

export function useSendBlockers({
  campaign,
  audience,
  gmailConnected,
  htmlBody,
  subject,
}: SendGuardrailsProps): { blockers: SendBlocker[]; canSend: boolean } {
  const blockers: SendBlocker[] = [];

  if (!gmailConnected) {
    blockers.push({ message: 'Gmail not connected. Connect Gmail in Settings.', severity: 'error' });
  }

  if (!subject?.trim()) {
    blockers.push({ message: 'Email subject is empty.', severity: 'error' });
  }

  if (!htmlBody?.trim()) {
    blockers.push({ message: 'Email body is empty.', severity: 'error' });
  }

  if (campaign.audience_count === 0) {
    blockers.push({ message: 'No recipients in audience. Build your audience first.', severity: 'error' });
  }

  if (!['draft', 'audience_ready', 'paused'].includes(campaign.status)) {
    blockers.push({
      message: `Campaign is in "${campaign.status}" status and cannot be sent.`,
      severity: 'error',
    });
  }

  if (campaign.failed_count > 0 && campaign.status !== 'draft') {
    blockers.push({
      message: `${campaign.failed_count} recipients failed in a prior attempt.`,
      severity: 'warning',
    });
  }

  const skippedCount = audience.filter(
    (m) => m.status === 'skipped' || m.status === 'duplicate'
  ).length;
  if (skippedCount > 0) {
    blockers.push({
      message: `${skippedCount} recipients were skipped/duplicated.`,
      severity: 'warning',
    });
  }

  const hasErrors = blockers.some((b) => b.severity === 'error');
  return { blockers, canSend: !hasErrors };
}

export function SendGuardrailsPanel({
  campaign,
  audience,
  gmailConnected,
  htmlBody,
  subject,
}: SendGuardrailsProps) {
  const { blockers } = useSendBlockers({
    campaign,
    audience,
    gmailConnected,
    htmlBody,
    subject,
  });

  const errors = blockers.filter((b) => b.severity === 'error');
  const warnings = blockers.filter((b) => b.severity === 'warning');
  const skippedRecipients = audience.filter(
    (m) => m.status === 'skipped' || m.status === 'duplicate'
  );

  if (blockers.length === 0) return null;

  return (
    <div className="space-y-3">
      {errors.map((b, i) => (
        <Alert key={`err-${i}`} variant="destructive">
          <Shield className="h-4 w-4" />
          <AlertDescription>{b.message}</AlertDescription>
        </Alert>
      ))}

      {warnings.map((b, i) => (
        <Alert key={`warn-${i}`}>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{b.message}</AlertDescription>
        </Alert>
      ))}

      {skippedRecipients.length > 0 && (
        <Collapsible>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="w-full justify-between">
              <span className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
                {skippedRecipients.length} recipients skipped
              </span>
              <ChevronDown className="h-4 w-4" />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="border rounded p-3 mt-1 space-y-1 max-h-[150px] overflow-y-auto">
              {skippedRecipients.map((m) => (
                <div key={m.id} className="flex items-center justify-between text-sm">
                  <span className="truncate">{m.email}</span>
                  <Badge variant="outline" className="text-xs">
                    {m.status}
                  </Badge>
                </div>
              ))}
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}
    </div>
  );
}

export function QuotaInfoCard() {
  return (
    <Alert>
      <Info className="h-4 w-4" />
      <AlertDescription>
        <p className="font-medium text-sm">Gmail Sending Limits</p>
        <ul className="text-xs text-muted-foreground mt-1 space-y-0.5 list-disc list-inside">
          <li>Rate limited to ~5 emails/second</li>
          <li>Daily quota varies by Gmail account type (standard: ~500/day, Workspace: ~2,000/day)</li>
          <li>
            <a
              href="https://support.google.com/a/answer/166852"
              target="_blank"
              rel="noopener noreferrer"
              className="underline"
            >
              View Gmail sending limits
            </a>
          </li>
        </ul>
      </AlertDescription>
    </Alert>
  );
}

export function QuotaHitBadge({ events }: { events: Array<{ event_type: string; meta?: unknown }> }) {
  const hasQuotaHit = events.some(
    (e) =>
      e.event_type === 'recipient_failed' &&
      typeof e.meta === 'object' &&
      e.meta !== null &&
      'error' in e.meta &&
      typeof (e.meta as Record<string, unknown>).error === 'string' &&
      ((e.meta as Record<string, string>).error.includes('quota') ||
        (e.meta as Record<string, string>).error.includes('429'))
  );

  if (!hasQuotaHit) return null;

  return (
    <Alert variant="destructive" className="border-amber-500 bg-amber-50 dark:bg-amber-950/30">
      <AlertTriangle className="h-4 w-4 text-amber-600" />
      <AlertDescription className="text-amber-800 dark:text-amber-200">
        <p className="font-medium text-sm">Gmail quota hit detected</p>
        <p className="text-xs mt-1">
          Some emails failed due to Gmail rate limits. Wait 24h for quota reset, then retry failed
          recipients.
        </p>
      </AlertDescription>
    </Alert>
  );
}
