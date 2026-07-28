import { useState } from 'react';
import {
  useLatestMetroNarrative,
  useMetroNarratives,
} from '@/hooks/useMetroNarratives';
import { NarrativeBlock } from './NarrativeBlock';
import { StorySuggestions } from './StorySuggestions';
import { Skeleton } from '@/components/ui/skeleton';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { MemoryPanel } from '@/components/memory/MemoryPanel';
import { Button } from '@/components/ui/button';
import {
  BookOpen,
  ChevronDown,
  ChevronRight,
  Leaf,
  Users,
  Eye,
  MapPin,
  MessageSquare,
  Calendar,
} from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

interface MetroNarrativePanelProps {
  metroId: string;
  metroName: string;
}

export function MetroNarrativePanel({ metroId, metroName }: MetroNarrativePanelProps) {
  const { data: latest, isLoading } = useLatestMetroNarrative(metroId);
  const { data: allNarratives } = useMetroNarratives(metroId);
  const [showHistory, setShowHistory] = useState(false);
  const [showNotes, setShowNotes] = useState(true);

  if (isLoading) {
    return (
      <div className="space-y-4 p-4">
        <Skeleton className="h-6 w-3/4" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  if (!latest) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center space-y-3">
        <div className="p-3 bg-muted rounded-full">
          <BookOpen className="w-6 h-6 text-muted-foreground" />
        </div>
        <p className="text-sm text-muted-foreground">No story has been written for {metroName} yet.</p>
        <p className="text-xs text-muted-foreground">Stories are generated as your community and partnerships evolve.</p>
      </div>
    );
  }

  const json = latest.narrative_json;
  const olderNarratives = (allNarratives ?? []).filter(n => n.id !== latest.id);

  return (
    <div className="space-y-6">
      {/* Living Memory — Echoes, Chapters, Check-ins */}
      <MemoryPanel scope="metro" entityId={metroId} entityName={metroName} />
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <h3 className="text-lg font-semibold leading-snug text-foreground">
            {latest.headline || `${metroName} Community Story`}
          </h3>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Calendar className="w-3 h-3" />
            {latest.period_start && latest.period_end ? (
              <span>{format(new Date(latest.period_start), 'MMM d')} – {format(new Date(latest.period_end), 'MMM d, yyyy')}</span>
            ) : (
              <span>{format(new Date(latest.created_at), 'MMM d, yyyy')}</span>
            )}
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowNotes(v => !v)}
          className={cn(
            'text-xs gap-1.5',
            showNotes ? 'text-primary' : 'text-muted-foreground',
          )}
        >
          <MessageSquare className="w-3.5 h-3.5" />
          {showNotes ? 'Hide notes' : 'My notes'}
        </Button>
      </div>

      {/* What's changing */}
      {json?.community_story && (
        <NarrativeBlock
          sectionKey="community_story"
          title="What's changing in our city"
          content={json.community_story}
          icon={<Leaf className="w-4 h-4 text-primary" />}
          narrativeId={latest.id}
          metroId={metroId}
          showNotes={showNotes}
        />
      )}

      {/* From our partners */}
      {json?.partner_story && (
        <NarrativeBlock
          sectionKey="partner_story"
          title="From our partners"
          content={json.partner_story}
          icon={<Users className="w-4 h-4 text-primary" />}
          narrativeId={latest.id}
          metroId={metroId}
          showNotes={showNotes}
        />
      )}

      {/* Emerging Patterns */}
      {json?.emerging_patterns && json.emerging_patterns.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-foreground flex items-center gap-2">
            <Eye className="w-4 h-4 text-primary" />
            Emerging patterns
          </h4>
          <ul className="space-y-1.5">
            {json.emerging_patterns.map((p: string, i: number) => (
              <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-primary/40 shrink-0" />
                {p}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* On the ground (from event reflections + local pulse) */}
      {json?.on_the_ground && json.on_the_ground.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-foreground flex items-center gap-2">
            <MapPin className="w-4 h-4 text-primary" />
            On the ground
          </h4>
          <ul className="space-y-1.5">
            {json.on_the_ground.map((item: string, i: number) => (
              <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-primary/40 shrink-0" />
                {item}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Looking ahead */}
      {json?.gentle_outlook && (
        <NarrativeBlock
          sectionKey="gentle_outlook"
          title="Looking ahead"
          content={json.gentle_outlook}
          narrativeId={latest.id}
          metroId={metroId}
          showNotes={showNotes}
        />
      )}

      {/* Story-driven partner suggestions */}
      <StorySuggestions narrativeId={latest.id} metroId={metroId} />

      {/* Previous stories */}
      {olderNarratives.length > 0 && (
        <Collapsible open={showHistory} onOpenChange={setShowHistory}>
          <CollapsibleTrigger className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors w-full">
            {showHistory ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            {olderNarratives.length} previous {olderNarratives.length === 1 ? 'chapter' : 'chapters'}
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-3 mt-3">
            {olderNarratives.map(n => (
              <div key={n.id} className="p-3 bg-muted/30 rounded-lg space-y-1">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-foreground">{n.headline || 'Community Story'}</p>
                  <span className="text-xs text-muted-foreground">
                    {n.period_start
                      ? `${format(new Date(n.period_start), 'MMM d')} – ${format(new Date(n.period_end || n.created_at), 'MMM d')}`
                      : format(new Date(n.created_at), 'MMM d, yyyy')}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground line-clamp-3">
                  {(n.narrative_json as Record<string, unknown>)?.gentle_outlook as string || ''}
                </p>
              </div>
            ))}
          </CollapsibleContent>
        </Collapsible>
      )}
    </div>
  );
}
