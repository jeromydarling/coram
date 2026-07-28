/**
 * ActivationPanel — Calm, narrative-driven first-presence system.
 *
 * WHAT: Combines activation stage, checklist, and timeline in one panel.
 * WHERE: Metro Detail Page (Expansion tab), Expansion Planning Canvas.
 * WHY: Guides tenants from planning → real world engagement without urgency.
 */

import { useActivationState, ActivationStage } from '@/hooks/useActivationState';
import { ActivationChecklist } from './ActivationChecklist';
import { ActivationTimeline } from './ActivationTimeline';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { HelpCircle, Sprout } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { useTestimoniumCapture } from '@/hooks/useTestimoniumCapture';
import { useActivationLog } from '@/hooks/useActivationLog';

const STAGE_DISPLAY: Record<ActivationStage, { label: string; description: string }> = {
  considering: { label: 'Considering', description: 'Exploring this community from afar.' },
  scouting: { label: 'Scouting', description: 'Learning about the local landscape.' },
  first_presence: { label: 'First Presence', description: 'Making initial connections.' },
  early_relationships: { label: 'Early Relationships', description: 'Building trust and familiarity.' },
  community_entry: { label: 'Community Entry', description: 'Welcomed into the community fabric.' },
};

interface Props {
  metroId: string;
  metroName: string;
}

export function ActivationPanel({ metroId, metroName }: Props) {
  const { state, isLoading, upsertState } = useActivationState(metroId);
  const { captureTestimonium } = useTestimoniumCapture();
  const { logEvent } = useActivationLog(metroId);

  const handleInitialize = async () => {
    await upsertState.mutateAsync('considering');
    logEvent(metroId, 'activation_stage_change', { stage: 'considering' });
    captureTestimonium({
      sourceModule: 'event',
      eventKind: 'activation_stage_change',
      metroId,
      summary: `Activation journey started for ${metroName}`,
      metadata: { stage: 'considering' },
    });
  };

  const handleManualAdvance = async () => {
    if (!state || state.activation_stage !== 'early_relationships') return;
    await upsertState.mutateAsync('community_entry');
    logEvent(metroId, 'activation_stage_change', { stage: 'community_entry', manual: true });
    captureTestimonium({
      sourceModule: 'event',
      eventKind: 'activation_stage_change',
      metroId,
      summary: `${metroName} reached Community Entry — a moment of belonging`,
      metadata: { stage: 'community_entry', manual: true },
    });
  };

  if (isLoading) {
    return <Skeleton className="h-64" />;
  }

  const currentStage = state?.activation_stage as ActivationStage | undefined;
  const stageInfo = currentStage ? STAGE_DISPLAY[currentStage] : null;
  const stages = Object.keys(STAGE_DISPLAY) as ActivationStage[];

  return (
    <Card className="rounded-xl border-primary/10">
      <CardContent className="p-5 space-y-5">
        {/* Header */}
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
            <Sprout className="h-4 w-4 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <h3
              className="text-base font-medium text-foreground"
              style={{ fontFamily: 'Georgia, serif' }}
            >
              Every community begins with presence.
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
              Activation Panel
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger><HelpCircle className="h-3 w-3" /></TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    <p className="text-xs">
                      <strong>What:</strong> Tracks the gentle progression from considering to community entry.<br />
                      <strong>Where:</strong> metro_activation_states table.<br />
                      <strong>Why:</strong> Guides first presence without urgency or deadlines.
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </p>
          </div>
        </div>

        {/* Not yet initialized */}
        {!state && (
          <div className="text-center py-6 space-y-3">
            <p
              className="text-sm text-muted-foreground"
              style={{ fontFamily: 'Georgia, serif' }}
            >
              Begin the journey of entering {metroName}.
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={handleInitialize}
              disabled={upsertState.isPending}
            >
              Start Activation Journey
            </Button>
          </div>
        )}

        {/* Active state */}
        {state && stageInfo && (
          <>
            {/* Stage progression */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                {stages.map((s, idx) => {
                  const isCurrent = s === currentStage;
                  const isPast = stages.indexOf(currentStage!) > idx;
                  return (
                    <div key={s} className="flex items-center gap-1">
                      <div
                        className={`w-2 h-2 rounded-full transition-colors ${
                          isCurrent
                            ? 'bg-primary'
                            : isPast
                            ? 'bg-primary/40'
                            : 'bg-muted'
                        }`}
                      />
                      <span
                        className={`text-xs ${
                          isCurrent
                            ? 'text-foreground font-medium'
                            : isPast
                            ? 'text-muted-foreground'
                            : 'text-muted-foreground/50'
                        }`}
                      >
                        {STAGE_DISPLAY[s].label}
                      </span>
                      {idx < stages.length - 1 && (
                        <span className="text-muted-foreground/30 mx-0.5">→</span>
                      )}
                    </div>
                  );
                })}
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="text-xs">
                  {stageInfo.label}
                </Badge>
                <span className="text-xs text-muted-foreground italic" style={{ fontFamily: 'Georgia, serif' }}>
                  {stageInfo.description}
                </span>
              </div>
            </div>

            {/* Manual community_entry advance */}
            {currentStage === 'early_relationships' && (
              <div className="rounded-lg bg-primary/5 border border-primary/10 p-3">
                <p className="text-sm text-foreground" style={{ fontFamily: 'Georgia, serif' }}>
                  When you feel welcomed into this community, mark this moment.
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-2 text-xs"
                  onClick={handleManualAdvance}
                  disabled={upsertState.isPending}
                >
                  We have entered this community
                </Button>
              </div>
            )}

            <Separator />

            {/* Checklist */}
            <ActivationChecklist metroId={metroId} />

            <Separator />

            {/* Timeline */}
            <ActivationTimeline metroId={metroId} />
          </>
        )}
      </CardContent>
    </Card>
  );
}
