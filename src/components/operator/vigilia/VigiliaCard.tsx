/**
 * VigiliaCard — Reusable awareness card for the Vigilia layer.
 *
 * WHAT: Displays narrative highlights in a calm, warm card.
 * WHERE: Embedded in Daily Rhythm, Presence, Activation, Crescere, Machina.
 * WHY: Consistent Vigilia voice across all zones.
 */
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Link } from 'react-router-dom';
import { Eye, ChevronRight } from 'lucide-react';
import type { VigiliaHighlight, VigiliaToне } from '@/lib/operator/vigilia';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { HelpCircle } from 'lucide-react';

const TONE_LABELS: Record<VigiliaToне, { label: string; variant: 'default' | 'secondary' | 'outline' }> = {
  steady: { label: 'Steady', variant: 'outline' },
  watchful: { label: 'Watchful', variant: 'secondary' },
  active: { label: 'Active', variant: 'default' },
};

interface VigiliaCardProps {
  title: string;
  highlights: VigiliaHighlight[];
  tone?: VigiliaToне;
  isLoading?: boolean;
  compact?: boolean;
  helpText?: string;
}

export function VigiliaCard({ title, highlights, tone, isLoading, compact, helpText }: VigiliaCardProps) {
  if (isLoading) {
    return (
      <Card className="border-primary/10">
        <CardContent className="pt-4 pb-3 space-y-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-10" />
          <Skeleton className="h-10" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-primary/10 bg-primary/[0.02]">
      <CardContent className={compact ? 'pt-3 pb-2' : 'pt-4 pb-3'}>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Eye className="w-3.5 h-3.5 text-primary/60" />
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              {title}
            </span>
            {helpText && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <HelpCircle className="w-3 h-3 text-muted-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs text-xs">{helpText}</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
          {tone && (
            <Badge variant={TONE_LABELS[tone].variant} className="text-[10px]">
              {TONE_LABELS[tone].label}
            </Badge>
          )}
        </div>
        <div className={compact ? 'space-y-1' : 'space-y-1.5'}>
          {highlights.map((h, i) => (
            <div key={i}>
              {h.link ? (
                <Link
                  to={h.link}
                  className="flex items-center justify-between gap-2 text-sm text-foreground hover:text-primary transition-colors group"
                >
                  <span className="leading-relaxed">{h.text}</span>
                  <ChevronRight className="w-3 h-3 text-muted-foreground group-hover:text-primary shrink-0" />
                </Link>
              ) : (
                <p className="text-sm text-muted-foreground leading-relaxed">{h.text}</p>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
