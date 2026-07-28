/**
 * StorySignalsCard — NRI Story Signals for staff Command Center.
 *
 * WHAT: Displays gentle narrative signals scoped to user's metros.
 * WHERE: Command Center sidebar.
 * WHY: Surfaces connections + check-ins without urgency or PII.
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { HelpTooltip } from '@/components/ui/help-tooltip';
import { useNriStorySignals, type NriStorySignal } from '@/hooks/useNriStorySignals';
import { Sparkles, Heart, Link2, Eye, PartyPopper } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { formatDistanceToNow } from 'date-fns';
import { NriInsightDrawer } from '@/components/nri/NriInsightDrawer';

export function StorySignalsCard() {
  const { data: signals, isLoading } = useNriStorySignals(5);
  const navigate = useNavigate();
  const { t } = useTranslation('dashboard');

  const kindConfig: Record<string, { icon: React.ElementType; label: string; color: string }> = {
    check_in: { icon: Eye, label: t('storySignals.kinds.checkIn'), color: 'text-blue-500' },
    connection: { icon: Link2, label: t('storySignals.kinds.connection'), color: 'text-violet-500' },
    heads_up: { icon: Heart, label: t('storySignals.kinds.headsUp'), color: 'text-amber-500' },
    celebration: { icon: PartyPopper, label: t('storySignals.kinds.celebration'), color: 'text-emerald-500' },
  };

  if (isLoading) return null;
  if (!signals || signals.length === 0) return null;

  return (
    <Card className="border-primary/10">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Sparkles className="w-4 h-4 text-primary" />
          {t('storySignals.title')}
          <HelpTooltip contentKey="card.story-signals" />
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          {t('storySignals.description')}
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        {signals.map((signal) => (
          <SignalItem key={signal.id} signal={signal} kindConfig={kindConfig} />
        ))}
      </CardContent>
    </Card>
  );
}

function SignalItem({
  signal,
  kindConfig,
}: {
  signal: NriStorySignal;
  kindConfig: Record<string, { icon: React.ElementType; label: string; color: string }>;
}) {
  const config = kindConfig[signal.kind] || kindConfig.check_in;
  const Icon = config.icon;
  const navigate = useNavigate();
  const { t } = useTranslation('dashboard');

  return (
    <div className="flex gap-3 p-2 rounded-lg hover:bg-accent/30 transition-colors">
      <div className={`mt-0.5 ${config.color}`}>
        <Icon className="w-4 h-4" />
      </div>
      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium truncate">{signal.title}</span>
          <Badge variant="outline" className="text-[10px] shrink-0">
            {config.label}
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed">
          {signal.summary}
        </p>
        <div className="flex items-center gap-2 pt-1 flex-wrap">
          {signal.opportunity_id && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 text-xs px-2"
              onClick={() => navigate(`/opportunities?selected=${signal.opportunity_id}`)}
            >
              {t('storySignals.openStory')}
            </Button>
          )}
          <NriInsightDrawer
            title={signal.title}
            summary={signal.summary}
            kind={signal.kind}
            evidence={signal.evidence}
            createdAt={signal.created_at}
            signalId={signal.id}
          />
          <span className="text-[10px] text-muted-foreground">
            {formatDistanceToNow(new Date(signal.created_at), { addSuffix: true })}
          </span>
        </div>
      </div>
    </div>
  );
}
