import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Zap, ExternalLink, Copy, Loader2 } from 'lucide-react';
import { useOpportunitySignalsDetail } from '@/hooks/useOpportunitySignals';
import { formatDistanceToNow, format } from 'date-fns';
import { toast } from '@/components/ui/sonner';

interface SignalsDrawerProps {
  opportunityId: string | null;
  organizationName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const SIGNAL_TYPE_LABELS: Record<string, string> = {
  leadership_change: 'Leadership Change',
  funding_round: 'Funding Round',
  expansion: 'Expansion',
  partnership: 'Partnership',
  hiring: 'Hiring',
  change: 'Change Detected',
  recommendation: 'Recommendation',
};

function getSignalTypeLabel(type: string) {
  return SIGNAL_TYPE_LABELS[type] || type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function ConfidenceDot({ confidence }: { confidence: number | null }) {
  if (confidence === null) return null;
  const color =
    confidence >= 0.8
      ? 'bg-success'
      : confidence >= 0.5
        ? 'bg-warning'
        : 'bg-muted-foreground';
  return (
    <span
      className={`inline-block w-2 h-2 rounded-full ${color}`}
      title={`Confidence: ${Math.round(confidence * 100)}%`}
    />
  );
}

export function SignalsDrawer({ opportunityId, organizationName, open, onOpenChange }: SignalsDrawerProps) {
  const { data: signals, isLoading } = useOpportunitySignalsDetail(open ? opportunityId : null);

  const copyRunId = (runId: string) => {
    navigator.clipboard.writeText(runId);
    toast.success('Run ID copied');
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-warning" />
            Signals — {organizationName}
          </SheetTitle>
        </SheetHeader>

        <div className="mt-6 space-y-4">
          {isLoading && (
            <div className="flex justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          )}

          {!isLoading && (!signals || signals.length === 0) && (
            <p className="text-sm text-muted-foreground text-center py-8">
              No signals detected yet.
            </p>
          )}

          {signals?.map((signal) => (
            <div
              key={signal.id}
              className="border border-border rounded-lg p-4 space-y-2"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="text-xs">
                    {getSignalTypeLabel(signal.signal_type)}
                  </Badge>
                  <ConfidenceDot confidence={signal.confidence} />
                </div>
                <span className="text-xs text-muted-foreground whitespace-nowrap">
                  {format(new Date(signal.detected_at), 'MMM d, yyyy')}
                  <span className="ml-1 opacity-60">
                    ({formatDistanceToNow(new Date(signal.detected_at), { addSuffix: true })})
                  </span>
                </span>
              </div>

              {signal.signal_value && (
                <p className="text-sm text-foreground">{signal.signal_value}</p>
              )}

              <div className="flex items-center gap-2 pt-1">
                {signal.source_url && (
                  <a
                    href={signal.source_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-primary hover:underline flex items-center gap-1"
                  >
                    <ExternalLink className="w-3 h-3" />
                    Source
                  </a>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-xs text-muted-foreground"
                  onClick={() => copyRunId(signal.run_id)}
                >
                  <Copy className="w-3 h-3 mr-1" />
                  {signal.run_id.slice(0, 8)}…
                </Button>
              </div>
            </div>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}
