import { Zap } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { OpportunitySignalSummary } from '@/hooks/useOpportunitySignals';
import { formatDistanceToNow } from 'date-fns';

interface SignalsBadgeProps {
  summary: OpportunitySignalSummary;
  onClick: (e: React.MouseEvent) => void;
}

export function SignalsBadge({ summary, onClick }: SignalsBadgeProps) {
  const timeAgo = formatDistanceToNow(new Date(summary.latest_at), { addSuffix: true });

  return (
    <Badge
      variant="outline"
      className="gap-1 cursor-pointer border-warning/40 bg-warning/10 text-warning hover:bg-warning/20 transition-colors text-xs"
      onClick={onClick}
      title={`${summary.count} signal${summary.count !== 1 ? 's' : ''} — latest ${timeAgo}`}
    >
      <Zap className="w-3 h-3" />
      {summary.count}
    </Badge>
  );
}
