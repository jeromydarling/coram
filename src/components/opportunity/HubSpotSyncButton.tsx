import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Loader2, ArrowUpDown, ExternalLink, CheckCircle2, HelpCircle } from 'lucide-react';
import { useHubSpotStatus, useHubSpotPush, useHubSpotObjectMap } from '@/hooks/useHubSpot';
import { format } from 'date-fns';

interface HubSpotSyncButtonProps {
  opportunityId: string;
}

export function HubSpotSyncButton({ opportunityId }: HubSpotSyncButtonProps) {
  const { data: status } = useHubSpotStatus();
  const { data: mapping } = useHubSpotObjectMap(opportunityId);
  const push = useHubSpotPush();

  if (!status?.isConnected) return null;

  const mode = status.connection?.hubspot_mode || 'company';
  const hubspotId = mapping?.hubspot_company_id || mapping?.hubspot_deal_id;
  const portalId = status.connection?.hubspot_portal_id;
  const lastSynced = mapping?.last_synced_at;

  const hubspotUrl = hubspotId && portalId
    ? mode === 'deal'
      ? `https://app.hubspot.com/contacts/${portalId}/deal/${hubspotId}`
      : `https://app.hubspot.com/contacts/${portalId}/company/${hubspotId}`
    : null;

  const handlePush = () => {
    push.mutate({ opportunity_ids: [opportunityId] });
  };

  return (
    <div className="flex items-center gap-1.5">
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              onClick={handlePush}
              disabled={push.isPending}
              className="h-7 text-xs"
            >
              {push.isPending ? (
                <Loader2 className="h-3 w-3 animate-spin mr-1" />
              ) : (
                <ArrowUpDown className="h-3 w-3 mr-1" />
              )}
              Sync
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p className="text-xs">Push this partner to HubSpot</p>
            {lastSynced && (
              <p className="text-xs text-muted-foreground">
                Last synced: {format(new Date(lastSynced), 'MMM d, h:mm a')}
              </p>
            )}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      {hubspotUrl && (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0"
                asChild
              >
                <a href={hubspotUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-3 w-3" />
                </a>
              </Button>
            </TooltipTrigger>
            <TooltipContent>View in HubSpot</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}

      {lastSynced && !hubspotUrl && (
        <CheckCircle2 className="h-3.5 w-3.5 text-green-600 dark:text-green-400" />
      )}
    </div>
  );
}
