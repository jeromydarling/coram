import { useState, useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { 
  BookOpen, 
  ChevronDown, 
  ChevronRight,
  ExternalLink,
  RefreshCw,
  Clock,
  Shield,
  Sparkles,
  TrendingUp,
  Minus,
  AlertCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { sanitizeMarkdownHtml } from '@/lib/sanitize';
import { 
  useStoryChapters, 
  useLatestStoryUpdates, 
  useChapterTimeline,
  useGenerateStory,
  type StoryUpdate,
} from '@/hooks/useRelationshipStory';

interface RelationshipStoryPanelProps {
  opportunityId: string;
  canGenerate?: boolean; // admin/regional_lead
}

const DELTA_CONFIG: Record<string, { label: string; className: string; icon: typeof Sparkles }> = {
  new_signal: { label: 'New Signal', className: 'bg-info/15 text-info', icon: Sparkles },
  shift: { label: 'Shift', className: 'bg-warning/15 text-warning', icon: TrendingUp },
  reinforcement: { label: 'Reinforcement', className: 'bg-muted text-muted-foreground', icon: Shield },
  correction: { label: 'Correction', className: 'bg-destructive/15 text-destructive', icon: AlertCircle },
  noop: { label: 'No Change', className: 'bg-muted text-muted-foreground', icon: Minus },
};

function confidenceLabel(c: number): { label: string; className: string } {
  if (c >= 0.7) return { label: 'High', className: 'text-success' };
  if (c >= 0.4) return { label: 'Med', className: 'text-warning' };
  return { label: 'Low', className: 'text-muted-foreground' };
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function renderMarkdown(md: string): string {
  // Simple markdown: **bold**, [link](url), bullet points
  const raw = md
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener" class="text-primary hover:underline">$1</a>')
    .replace(/^- (.+)$/gm, '<li class="ml-4">$1</li>')
    .replace(/\n/g, '<br/>');
  return sanitizeMarkdownHtml(raw);
}

function ChapterCard({ 
  chapterTitle, 
  family, 
  latestUpdate, 
  chapterId,
}: { 
  chapterTitle: string; 
  family: string; 
  latestUpdate: StoryUpdate | null; 
  chapterId: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const [showTimeline, setShowTimeline] = useState(false);
  const [timelinePage, setTimelinePage] = useState(0);
  const { data: timeline = [] } = useChapterTimeline(showTimeline ? chapterId : null, timelinePage);

  const delta = latestUpdate ? DELTA_CONFIG[latestUpdate.delta_type] ?? DELTA_CONFIG.noop : null;
  const conf = latestUpdate ? confidenceLabel(latestUpdate.confidence) : null;

  return (
    <Card className="border-border/50">
      <Collapsible open={expanded} onOpenChange={setExpanded}>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-muted/30 transition-colors py-3 px-4">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                {expanded ? <ChevronDown className="w-4 h-4 shrink-0 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 shrink-0 text-muted-foreground" />}
                <CardTitle className="text-sm font-medium truncate">{chapterTitle}</CardTitle>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {delta && (
                  <Badge className={cn('text-[10px] font-medium', delta.className)}>
                    {delta.label}
                  </Badge>
                )}
                {conf && (
                  <span className={cn('text-[10px] font-medium', conf.className)}>{conf.label}</span>
                )}
                {latestUpdate && (
                  <span className="text-[10px] text-muted-foreground">
                    {formatDate(latestUpdate.generated_at)}
                  </span>
                )}
              </div>
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="pt-0 px-4 pb-4 space-y-3">
            {latestUpdate ? (
              <>
                <div 
                  className="text-sm text-foreground/90 leading-relaxed prose prose-sm max-w-none"
                  dangerouslySetInnerHTML={{ __html: renderMarkdown(latestUpdate.summary_md) }}
                />

                {/* Evidence */}
                {latestUpdate.evidence.length > 0 && (
                  <details className="text-xs">
                    <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                      {latestUpdate.evidence.length} evidence item{latestUpdate.evidence.length !== 1 ? 's' : ''}
                    </summary>
                    <ul className="mt-1 space-y-1 pl-2">
                      {latestUpdate.evidence.slice(0, 5).map((ev, i) => (
                        <li key={i} className="flex items-start gap-1 text-muted-foreground">
                          <span className="shrink-0">•</span>
                          <span className="truncate">{ev.snippet?.slice(0, 80)}</span>
                          {ev.url && (
                            <a href={ev.url} target="_blank" rel="noopener" className="shrink-0">
                              <ExternalLink className="w-3 h-3 text-primary" />
                            </a>
                          )}
                        </li>
                      ))}
                    </ul>
                  </details>
                )}

                {/* Timeline toggle */}
                <button
                  onClick={(e) => { e.stopPropagation(); setShowTimeline(!showTimeline); }}
                  className="text-xs text-primary hover:underline flex items-center gap-1"
                >
                  <Clock className="w-3 h-3" />
                  {showTimeline ? 'Hide timeline' : 'Show timeline'}
                </button>

                {showTimeline && timeline.length > 0 && (
                  <div className="space-y-2 pl-3 border-l-2 border-border ml-1">
                    {timeline.map((update) => {
                      const uDelta = DELTA_CONFIG[update.delta_type] ?? DELTA_CONFIG.noop;
                      return (
                        <div key={update.id} className="text-xs space-y-0.5">
                          <div className="flex items-center gap-2">
                            <span className="text-muted-foreground">{formatDate(update.generated_at)}</span>
                            <Badge className={cn('text-[9px]', uDelta.className)}>{uDelta.label}</Badge>
                          </div>
                          <p className="text-foreground/80">{update.summary_md.slice(0, 150)}…</p>
                        </div>
                      );
                    })}
                    {timeline.length >= 5 && (
                      <button
                        onClick={() => setTimelinePage(p => p + 1)}
                        className="text-xs text-primary hover:underline"
                      >
                        Show older
                      </button>
                    )}
                  </div>
                )}
              </>
            ) : (
              <p className="text-sm text-muted-foreground italic">No story updates yet. Generate the first update to begin the narrative.</p>
            )}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}

export function RelationshipStoryPanel({ opportunityId, canGenerate = false }: RelationshipStoryPanelProps) {
  const { data: chapters = [], isLoading: chaptersLoading } = useStoryChapters(opportunityId);
  const { data: allUpdates = [], isLoading: updatesLoading } = useLatestStoryUpdates(opportunityId);
  const generateStory = useGenerateStory(opportunityId);

  // Group latest update by chapter_id
  const latestByChapter = useMemo(() => {
    const map = new Map<string, StoryUpdate>();
    for (const u of allUpdates) {
      if (!map.has(u.chapter_id)) map.set(u.chapter_id, u);
    }
    return map;
  }, [allUpdates]);

  const isLoading = chaptersLoading || updatesLoading;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-semibold">Relationship Story</h3>
        </div>
        {canGenerate && (
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5 text-xs h-7"
            onClick={() => generateStory.mutate(true as boolean)}
            disabled={generateStory.isPending}
          >
            <RefreshCw className={cn('w-3 h-3', generateStory.isPending && 'animate-spin')} />
            {generateStory.isPending ? 'Generating…' : 'Generate Update'}
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-12 bg-muted/30 rounded-lg animate-pulse" />
          ))}
        </div>
      ) : chapters.length === 0 ? (
        <p className="text-sm text-muted-foreground italic">
          No story chapters yet. {canGenerate ? 'Click "Generate Update" to start the narrative.' : 'An admin can initiate the first story generation.'}
        </p>
      ) : (
        <div className="space-y-2">
          {chapters.filter(c => c.is_active).map(chapter => (
            <ChapterCard
              key={chapter.id}
              chapterTitle={chapter.chapter_title}
              family={chapter.family}
              latestUpdate={latestByChapter.get(chapter.id) ?? null}
              chapterId={chapter.id}
            />
          ))}
        </div>
      )}
    </div>
  );
}
