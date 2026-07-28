import { Card, CardContent } from '@/components/ui/card';
import { Sparkles } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface CommunioSignalCardProps {
  signalType: string;
  signalSummary: string;
  createdAt: string;
  metroName?: string | null;
}

const typeLabels: Record<string, string> = {
  device_demand_increase: 'Community Need',
  partnership_opportunity: 'Partnership Signal',
  event_overlap: 'Shared Interest',
  workforce_trend: 'Workforce Signal',
  funding_landscape: 'Funding Landscape',
  digital_inclusion: 'Digital Inclusion',
};

export function CommunioSignalCard({ signalType, signalSummary, createdAt, metroName }: CommunioSignalCardProps) {
  const label = typeLabels[signalType] || signalType.replace(/_/g, ' ');

  return (
    <Card className="rounded-xl border-border/40 bg-card/80">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
            <Sparkles className="h-4 w-4 text-primary" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className="text-xs font-medium text-primary capitalize">{label}</span>
              {metroName && (
                <span className="text-xs text-muted-foreground">· {metroName}</span>
              )}
            </div>
            <p className="text-sm font-serif text-foreground/90 leading-relaxed">
              {signalSummary}
            </p>
            <p className="text-xs text-muted-foreground mt-2">
              {formatDistanceToNow(new Date(createdAt), { addSuffix: true })}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
