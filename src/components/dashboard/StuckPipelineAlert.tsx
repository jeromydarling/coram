import { AnchorPipeline } from '@/types';
import { cn } from '@/lib/utils';
import { AlertTriangle, Clock, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toChapterLabel, CHAPTER_BADGE_CLASS } from '@/lib/journeyChapters';
import { HelpTooltip } from '@/components/ui/help-tooltip';
import { useTranslation } from 'react-i18next';

interface StuckPipelineAlertProps {
  pipeline: AnchorPipeline[];
}

export function StuckPipelineAlert({ pipeline }: StuckPipelineAlertProps) {
  const { t } = useTranslation('dashboard');
  const stuckItems = pipeline.filter(p => p.daysInStage > 30);

  if (stuckItems.length === 0) {
    return null;
  }

  const getStageBadge = (stage: string) => {
    const chapter = toChapterLabel(stage);
    return CHAPTER_BADGE_CLASS[chapter] || 'stage-target';
  };

  const getChapterDisplay = (stage: string) => toChapterLabel(stage);

  return (
    <div className="bg-destructive/5 border border-destructive/20 rounded-xl p-4 animate-fade-in">
      <div className="flex items-center gap-2 mb-4">
        <div className="p-2 bg-destructive/10 rounded-lg">
          <AlertTriangle className="w-5 h-5 text-destructive" />
        </div>
        <div>
          <h3 className="font-semibold text-foreground">{t('alerts.journeyAttentionRequired')}</h3>
          <p className="text-sm text-muted-foreground">
            {t('alerts.stuckDescription', { count: stuckItems.length })}
          </p>
        </div>
        <HelpTooltip contentKey="card.stuck-pipeline" />
      </div>

      <div className="space-y-3">
        {stuckItems.map((item) => (
          <div
            key={item.anchorPipelineId}
            className="bg-card rounded-lg border border-border p-3 flex items-center justify-between"
          >
            <div className="flex items-center gap-4">
              <div>
                <p className="font-medium text-foreground">{item.organization}</p>
                <p className="text-sm text-muted-foreground">{item.metro}</p>
              </div>
              <span className={cn('stage-badge', getStageBadge(item.stage))}>
                {getChapterDisplay(item.stage)}
              </span>
            </div>

            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1 text-destructive">
                <Clock className="w-4 h-4" />
                <span className="font-semibold">{item.daysInStage} {t('alerts.days')}</span>
              </div>
              <Button variant="ghost" size="sm" className="gap-1">
                {t('alerts.view')} <ArrowRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
