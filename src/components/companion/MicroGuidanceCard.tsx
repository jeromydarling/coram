/**
 * MicroGuidanceCard — Calm, non-intrusive guidance card.
 *
 * WHAT: Warm neutral card with serif title, dismiss/CTA actions.
 * WHERE: Rendered by CompanionTray in bottom-right tray.
 * WHY: Gentle contextual guidance following Ignatian design principles.
 */
import { useTranslation } from 'react-i18next';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { X, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { openNavItem } from '@/lib/nav/openNavItem';
import type { MicroGuide } from '@/content/microGuidanceRegistry';

const serif = { fontFamily: 'Georgia, "Times New Roman", serif' };

interface MicroGuidanceCardProps {
  guide: MicroGuide;
  onAccept: () => void;
  onDismiss: () => void;
}

export function MicroGuidanceCard({ guide, onAccept, onDismiss }: MicroGuidanceCardProps) {
  const { t } = useTranslation('narrative');
  const navigate = useNavigate();

  const handleCta = () => {
    onAccept();
    if (guide.ctaAction) {
      if (guide.ctaAction.type === 'navigate') {
        if (guide.ctaAction.navTestId) {
          openNavItem(guide.ctaAction.navTestId);
        } else {
          navigate(guide.ctaAction.path);
        }
      } else if (guide.ctaAction.type === 'scroll') {
        const el = document.querySelector(guide.ctaAction.selector);
        el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  };

  return (
    <Card
      className="w-80 max-w-[calc(100vw-2rem)] border border-border/60 shadow-lg bg-card/95 backdrop-blur-sm animate-in slide-in-from-bottom-4 fade-in duration-500"
      data-testid="companion-guidance-card"
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-sm font-semibold text-foreground leading-snug" style={serif}>
            {guide.title}
          </h3>
          <button
            onClick={onDismiss}
            className="shrink-0 p-0.5 rounded-sm text-muted-foreground hover:text-foreground transition-colors"
            aria-label={t('microGuidanceCard.dismissAriaLabel')}
            data-testid="companion-dismiss"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
        <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
          {guide.body}
        </p>
        {guide.ctaLabel && (
          <Button
            variant="ghost"
            size="sm"
            className="mt-3 h-7 px-3 text-xs text-primary hover:text-primary gap-1.5"
            onClick={handleCta}
            data-testid="companion-cta"
          >
            {guide.ctaLabel}
            <ArrowRight className="w-3 h-3" />
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
