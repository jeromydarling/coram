/**
 * ProvidenceSection — "Providence — This Season" in the Compass drawer.
 *
 * WHAT: Shows the most recent Providence report with collapsible narrative + version history.
 * WHERE: AIChatDrawer, below Today's Movement.
 * WHY: Long-arc seasonal reflection — calm, never auto-opened, regenerable by stewards.
 */

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { HelpTooltip } from '@/components/ui/help-tooltip';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Heart, Compass, RotateCcw, Shield, ChevronDown, Sparkles, Download, Loader2, History } from 'lucide-react';
import { useProvidenceReport } from '@/hooks/useProvidenceReport';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { generateProvidencePDF } from '@/lib/buildProvidencePDF';
import type { ProvidenceDirection } from '@/lib/providenceEngine';

const DIRECTION_ICON: Record<string, typeof Heart> = {
  care: Heart,
  expansion: Compass,
  restoration: RotateCcw,
  steadfastness: Shield,
};

const DIRECTION_CLASS: Record<string, string> = {
  care: 'text-[hsl(142_40%_55%)]',
  expansion: 'text-primary',
  restoration: 'text-[hsl(40_80%_60%)]',
  steadfastness: 'text-accent-foreground',
};

export function ProvidenceSection() {
  const { report, history, isLoading, generate, isGenerating, loadReport } = useProvidenceReport();
  const { isSteward } = useAuth();
  const canGenerate = isSteward;
  const [isOpen, setIsOpen] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  if (isLoading) return null;

  // No report yet — show gentle generate button for stewards
  if (!report) {
    if (!isSteward) return null;
    return (
      <div className="space-y-2 pb-3 mb-3 border-b border-border/30">
        <div className="flex items-center gap-2">
          <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Providence
          </h4>
          <HelpTooltip
            what="A seasonal reflection on your workspace's relational arc — generated from movement patterns."
            where="Compass drawer"
            why="Long-arc awareness complements daily nudges with deeper seasonal insight."
          />
        </div>
        <Button
          variant="outline"
          size="sm"
          className="w-full gap-2 text-xs"
          onClick={() => generate('manual')}
          disabled={isGenerating}
        >
          {isGenerating ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <Sparkles className="h-3 w-3" />
          )}
          Generate seasonal reflection
        </Button>
      </div>
    );
  }

  const Icon = DIRECTION_ICON[report.dominant_direction] || Compass;
  const dirClass = DIRECTION_CLASS[report.dominant_direction] || 'text-primary';

  const handleExport = () => {
    const doc = generateProvidencePDF({
      seasonLabel: report.season_label,
      classification: report.classification,
      dominantDirection: report.dominant_direction as ProvidenceDirection,
      narrative: report.narrative_shareable,
      periodStart: report.period_start,
      periodEnd: report.period_end,
      version: report.version,
    });
    doc.save(`Providence-${report.season_label.replace(/\s+/g, '-')}.pdf`);
  };

  return (
    <div className="space-y-2 pb-3 mb-3 border-b border-border/30">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger className="flex items-center gap-2 w-full group">
          <Icon className={cn('h-3.5 w-3.5', dirClass)} />
          <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex-1 text-left">
            Providence — This Season
          </h4>
          <HelpTooltip
            what="A seasonal reflection on your workspace's relational arc — generated from movement patterns."
            where="Compass drawer"
            why="Long-arc awareness complements daily nudges with deeper seasonal insight."
          />
          <ChevronDown className={cn(
            'h-3.5 w-3.5 text-muted-foreground transition-transform',
            isOpen && 'rotate-180'
          )} />
        </CollapsibleTrigger>

        <CollapsibleContent className="space-y-3 pt-2">
          {/* Season label */}
          <div className="flex items-center gap-2">
            <span className={cn('text-sm font-medium', dirClass)}>
              {report.season_label}
            </span>
            <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
              {report.classification}
            </span>
          </div>

          {/* Private narrative */}
          <p className="text-sm text-foreground/85 leading-relaxed whitespace-pre-wrap">
            {report.narrative_private}
          </p>

          {/* Actions */}
          <div className="flex items-center gap-2 pt-1 flex-wrap">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-[11px] gap-1.5"
              onClick={handleExport}
            >
              <Download className="h-3 w-3" />
              Export shareable
            </Button>
            {isSteward && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-[11px] gap-1.5"
                onClick={() => generate('manual')}
                disabled={isGenerating}
              >
                {isGenerating ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Sparkles className="h-3 w-3" />
                )}
                Regenerate
              </Button>
            )}
            {history.length > 1 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-[11px] gap-1.5"
                onClick={() => setShowHistory(!showHistory)}
              >
                <History className="h-3 w-3" />
                {showHistory ? 'Hide history' : 'Past seasons'}
              </Button>
            )}
          </div>

          {/* Version history browser */}
          {showHistory && history.length > 1 && (
            <div className="pt-1">
              <Select
                value={report.id}
                onValueChange={(id) => {
                  if (id !== report.id) loadReport(id);
                }}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Select a past report" />
                </SelectTrigger>
                <SelectContent>
                  {history.map((h) => (
                    <SelectItem key={h.id} value={h.id} className="text-xs">
                      {h.season_label} · v{h.version} · {h.period_start}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Version / period footer */}
          <p className="text-[10px] text-muted-foreground">
            v{report.version} · {report.period_start} — {report.period_end}
          </p>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
