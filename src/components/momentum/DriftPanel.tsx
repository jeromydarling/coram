import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { TrendingUp, ArrowUpRight, ArrowDownRight, Eye, History } from 'lucide-react';
import type { MetroDriftData, DriftTopicEntry } from '@/hooks/useMetroDrift';
import { useState } from 'react';

interface DriftPanelProps {
  drift: MetroDriftData | null;
  isLoading: boolean;
  history?: MetroDriftData[];
  historyLoading?: boolean;
}

const driftLabelConfig = {
  steady: { text: 'Steady', className: 'bg-muted text-muted-foreground' },
  shifting: { text: 'Shifting', className: 'bg-accent/20 text-accent-foreground' },
  changing: { text: 'Changing', className: 'bg-primary/20 text-primary' },
} as const;

function TopicList({ title, icon: Icon, topics, emptyText }: {
  title: string;
  icon: typeof TrendingUp;
  topics: DriftTopicEntry[];
  emptyText: string;
}) {
  if (topics.length === 0) {
    return (
      <div className="space-y-1">
        <h4 className="text-xs font-medium flex items-center gap-1.5 text-muted-foreground">
          <Icon className="w-3.5 h-3.5" />
          {title}
        </h4>
        <p className="text-xs text-muted-foreground/60 italic">{emptyText}</p>
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <h4 className="text-xs font-medium flex items-center gap-1.5 text-muted-foreground">
        <Icon className="w-3.5 h-3.5" />
        {title}
      </h4>
      <div className="flex flex-wrap gap-1.5">
        {topics.slice(0, 5).map((t, i) => (
          <Badge key={i} variant="outline" className="text-xs font-normal capitalize">
            {t.topic.replace(/-/g, ' ')}
            {t.delta !== 0 && (
              <span className="ml-1 text-muted-foreground">
                {t.delta > 0 ? '+' : ''}{t.delta}
              </span>
            )}
          </Badge>
        ))}
      </div>
    </div>
  );
}

export function DriftPanel({ drift, isLoading, history, historyLoading }: DriftPanelProps) {
  const [showHistory, setShowHistory] = useState(false);

  if (isLoading) {
    return (
      <div className="space-y-3 p-4 bg-muted/20 rounded-lg">
        <Skeleton className="h-5 w-2/3" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-12 w-full" />
      </div>
    );
  }

  if (!drift) {
    return (
      <div className="p-4 bg-muted/20 rounded-lg">
        <p className="text-sm text-muted-foreground italic">
          No drift data available yet. It will appear after narrative builds run.
        </p>
      </div>
    );
  }

  const label = driftLabelConfig[drift.driftLabel];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="p-4 bg-gradient-to-br from-muted/30 to-muted/10 rounded-lg space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium">What's changing in the story</h3>
          <Badge className={label.className}>{label.text}</Badge>
        </div>
        <p className="text-sm text-muted-foreground">{drift.summaryMd}</p>
        <p className="text-xs text-muted-foreground/60">
          {drift.periodStart} — {drift.periodEnd}
        </p>
      </div>

      {/* Topic sections */}
      <div className="space-y-3">
        <TopicList
          title="Emerging"
          icon={ArrowUpRight}
          topics={drift.emergingTopics}
          emptyText="No new themes this period."
        />

        <TopicList
          title="Accelerating"
          icon={TrendingUp}
          topics={drift.acceleratingTopics}
          emptyText="No topics gaining momentum."
        />

        {/* Divergence — "Different lenses" */}
        {Object.keys(drift.divergence).length > 0 ? (
          <div className="space-y-1.5">
            <h4 className="text-xs font-medium flex items-center gap-1.5 text-muted-foreground">
              <Eye className="w-3.5 h-3.5" />
              Different lenses
            </h4>
            <p className="text-xs text-muted-foreground">
              Community signals and personal reflections are telling different stories this period.
            </p>
          </div>
        ) : (
          <div className="space-y-1">
            <h4 className="text-xs font-medium flex items-center gap-1.5 text-muted-foreground">
              <Eye className="w-3.5 h-3.5" />
              Different lenses
            </h4>
            <p className="text-xs text-muted-foreground/60 italic">
              Community and personal perspectives are aligned.
            </p>
          </div>
        )}
      </div>

      <Separator />

      {/* History toggle */}
      <Button
        variant="ghost"
        size="sm"
        className="w-full gap-2 text-xs"
        onClick={() => setShowHistory(!showHistory)}
      >
        <History className="w-3.5 h-3.5" />
        {showHistory ? 'Hide drift history' : 'View drift history'}
      </Button>

      {showHistory && (
        <div className="space-y-2">
          {historyLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : (history ?? []).length === 0 ? (
            <p className="text-xs text-muted-foreground italic text-center py-2">
              No previous drift records.
            </p>
          ) : (
            (history ?? []).map(h => (
              <div key={h.id} className="flex items-center justify-between p-2 rounded-md bg-muted/30 text-xs">
                <div>
                  <span className="font-medium">{h.periodStart} — {h.periodEnd}</span>
                  <Badge className={`ml-2 ${driftLabelConfig[h.driftLabel].className}`} variant="outline">
                    {driftLabelConfig[h.driftLabel].text}
                  </Badge>
                </div>
                <span className="text-muted-foreground">Score: {h.driftScore}</span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
