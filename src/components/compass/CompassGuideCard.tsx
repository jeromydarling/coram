/**
 * CompassGuideCard — Contextual onboarding card inside the Compass drawer.
 *
 * WHAT: Shows a friendly explanation of the current section for new users.
 * WHERE: Top of AIChatDrawer, above Today's Movement.
 * WHY: Reduces overwhelm for new users by explaining what they're looking at,
 *      what key terms mean, and what they can expect to find.
 */

import { X, BookOpen, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { HelpTooltip } from '@/components/ui/help-tooltip';
import type { GuideEntry } from '@/content/compassGuide';

const serif = { fontFamily: 'Georgia, "Times New Roman", serif' };

interface CompassGuideCardProps {
  guide: GuideEntry;
  onDismissGuide: () => void;
}

export function CompassGuideCard({ guide, onDismissGuide }: CompassGuideCardProps) {
  return (
    <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-3 relative">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <BookOpen className="h-3.5 w-3.5 text-primary" />
          </div>
          <div>
            <p className="text-xs font-medium text-primary/60 uppercase tracking-wider">
              Welcome Guide
            </p>
            <h3 className="text-sm font-semibold text-foreground" style={serif}>
              {guide.title}
            </h3>
          </div>
        </div>
        <HelpTooltip
          what="A gentle guide that explains each section during your first few days."
          where="Compass drawer"
          why="Helps you feel at home without reading a manual."
        />
      </div>

      {/* What */}
      <p className="text-sm text-foreground/80 leading-relaxed">
        {guide.what}
      </p>

      {/* Why */}
      <div className="text-xs text-muted-foreground leading-relaxed">
        <span className="font-medium text-foreground/60">Why it matters: </span>
        {guide.why}
      </div>

      {/* Expect */}
      <div className="text-xs text-muted-foreground leading-relaxed">
        <span className="font-medium text-foreground/60">What to expect: </span>
        {guide.expect}
      </div>

      {/* Terms */}
      {guide.terms && guide.terms.length > 0 && (
        <div className="space-y-1.5 pt-1">
          <p className="text-xs font-medium text-foreground/50 uppercase tracking-wider flex items-center gap-1">
            <Sparkles className="h-3 w-3" /> Key terms
          </p>
          {guide.terms.map((t) => (
            <div key={t.word} className="text-xs leading-relaxed">
              <span className="font-semibold text-foreground/70">{t.word}</span>
              <span className="text-muted-foreground"> — {t.meaning}</span>
            </div>
          ))}
        </div>
      )}

      {/* Dismiss forever */}
      <div className="pt-1 flex justify-end">
        <Button
          variant="ghost"
          size="sm"
          className="text-xs text-muted-foreground hover:text-foreground gap-1"
          onClick={onDismissGuide}
        >
          <X className="h-3 w-3" />
          I'm comfortable — turn off guide
        </Button>
      </div>
    </div>
  );
}
