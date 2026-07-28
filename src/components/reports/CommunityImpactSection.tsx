import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Waves, Calendar, Sparkles } from 'lucide-react';
import type { CommunityImpactData } from '@/hooks/useHumanImpactData';

interface CommunityImpactSectionProps {
  data: CommunityImpactData;
}

export function CommunityImpactSection({ data }: CommunityImpactSectionProps) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <Waves className="w-5 h-5 text-primary" />
          What We're Seeing in the Community
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Key counts */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-muted/30 rounded-lg p-3 text-center">
            <div className="text-xl font-bold">{data.eventsParticipated}</div>
            <div className="text-[11px] text-muted-foreground">Events Participated</div>
          </div>
          <div className="bg-muted/30 rounded-lg p-3 text-center">
            <div className="text-xl font-bold">{data.localPulseCount}</div>
            <div className="text-[11px] text-muted-foreground">Community Signals</div>
          </div>
          <div className="bg-muted/30 rounded-lg p-3 text-center">
            <div className="text-xl font-bold">{data.signalCount}</div>
            <div className="text-[11px] text-muted-foreground">Themes Emerging</div>
          </div>
        </div>

        {/* Themes */}
        {data.themes.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5" />
              Emerging Themes
            </h4>
            <div className="flex flex-wrap gap-1.5">
              {data.themes.map((theme, i) => (
                <Badge key={i} variant="secondary" className="text-xs font-normal">
                  {theme}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Narrative snippets (headlines only — no raw text) */}
        {data.narrativeSnippets.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-muted-foreground">Community Headlines</h4>
            <div className="space-y-1.5">
              {data.narrativeSnippets.map((snippet, i) => (
                <p key={i} className="text-sm text-foreground/70 pl-3 border-l-2 border-primary/20">
                  {snippet}
                </p>
              ))}
            </div>
          </div>
        )}

        {data.themes.length === 0 && data.narrativeSnippets.length === 0 && (
          <p className="text-sm text-muted-foreground/60 italic text-center py-4">
            Community narratives are forming — check back as the story unfolds.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
