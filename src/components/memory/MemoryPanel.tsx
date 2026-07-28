import { useState } from 'react';
import { Feather, BookOpen, Heart, ChevronDown, ChevronRight, Mail, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useMemoryThread, type MemoryEcho, type MemoryChapter, type MemoryCheckin } from '@/hooks/useMemoryThreads';
import { CheckInEmailModal } from '@/components/memory/CheckInEmailModal';
import { Skeleton } from '@/components/ui/skeleton';

interface MemoryPanelProps {
  scope: 'opportunity' | 'metro';
  entityId: string;
  entityName?: string;
}

const DISMISSED_KEY = 'profunda_dismissed_checkins';

function getDismissed(): string[] {
  try {
    return JSON.parse(localStorage.getItem(DISMISSED_KEY) || '[]');
  } catch { return []; }
}

function dismissCheckin(key: string) {
  const current = getDismissed();
  if (!current.includes(key)) {
    current.push(key);
    localStorage.setItem(DISMISSED_KEY, JSON.stringify(current));
  }
}

export function MemoryPanel({ scope, entityId, entityName }: MemoryPanelProps) {
  const { data, isLoading } = useMemoryThread(scope, entityId);

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-5 w-48" />
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    );
  }

  const memory = data?.memory;
  if (!memory || (!memory.chapters.length && !memory.echoes.length && !memory.checkins.length)) {
    return null; // Nothing to show yet
  }

  return (
    <div className="space-y-4">
      {/* Headline */}
      {memory.headline && (
        <p className="text-sm font-medium text-foreground">{memory.headline}</p>
      )}

      {/* Echoes */}
      {memory.echoes.length > 0 && (
        <EchoesSection echoes={memory.echoes} />
      )}

      {/* Chapters */}
      {memory.chapters.length > 0 && (
        <ChaptersSection chapters={memory.chapters} />
      )}

      {/* Check-ins */}
      {memory.checkins.length > 0 && (
        <CheckInsSection checkins={memory.checkins} entityName={entityName} />
      )}
    </div>
  );
}

function EchoesSection({ echoes }: { echoes: MemoryEcho[] }) {
  return (
    <div className="space-y-2">
      <h4 className="text-xs font-medium text-muted-foreground flex items-center gap-1.5 uppercase tracking-wide">
        <Feather className="w-3.5 h-3.5 text-primary/60" />
        Echoes
      </h4>
      <div className="space-y-2">
        {echoes.map((echo, i) => (
          <Card key={i} className="border-border/40 bg-muted/20">
            <CardContent className="p-3 space-y-1">
              <p className="text-sm font-medium text-foreground">{echo.title}</p>
              <p className="text-xs text-muted-foreground leading-relaxed">{echo.text}</p>
              <p className="text-[10px] text-muted-foreground/70 italic">
                An echo from {echo.lookback_window}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function ChaptersSection({ chapters }: { chapters: MemoryChapter[] }) {
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);

  return (
    <div className="space-y-2">
      <h4 className="text-xs font-medium text-muted-foreground flex items-center gap-1.5 uppercase tracking-wide">
        <BookOpen className="w-3.5 h-3.5 text-primary/60" />
        Chapters
      </h4>
      <div className="space-y-1.5">
        {chapters.slice(0, 4).map((chapter, i) => (
          <Collapsible key={i} open={expandedIdx === i} onOpenChange={(open) => setExpandedIdx(open ? i : null)}>
            <CollapsibleTrigger className="flex items-center gap-2 w-full text-left p-2 rounded-md hover:bg-muted/30 transition-colors">
              {expandedIdx === i ? (
                <ChevronDown className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
              ) : (
                <ChevronRight className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
              )}
              <span className="text-sm font-medium text-foreground flex-1 truncate">{chapter.title}</span>
              <div className="flex gap-1">
                {chapter.themes.slice(0, 2).map((theme, ti) => (
                  <Badge key={ti} variant="secondary" className="text-[9px] px-1.5 py-0">
                    {theme}
                  </Badge>
                ))}
              </div>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="pl-6 pb-2 space-y-1.5">
                <p className="text-[10px] text-muted-foreground">
                  {chapter.window_start} — {chapter.window_end}
                </p>
                {chapter.highlights.map((h, hi) => (
                  <div key={hi} className="flex items-start gap-1.5 text-xs text-muted-foreground">
                    <span className="mt-1 w-1.5 h-1.5 rounded-full bg-primary/40 shrink-0" />
                    <span>{h.text}</span>
                    {h.source_url && (
                      <a href={h.source_url} target="_blank" rel="noopener" className="text-primary hover:underline shrink-0 text-[10px]">↗</a>
                    )}
                  </div>
                ))}
              </div>
            </CollapsibleContent>
          </Collapsible>
        ))}
      </div>
    </div>
  );
}

function CheckInsSection({ checkins, entityName }: { checkins: MemoryCheckin[]; entityName?: string }) {
  const [dismissed, setDismissed] = useState<string[]>(getDismissed());
  const [emailModal, setEmailModal] = useState<{ open: boolean; checkin: MemoryCheckin | null }>({ open: false, checkin: null });

  const visibleCheckins = checkins.filter(ci => !dismissed.includes(`${ci.opportunity_id}:${ci.suggested_subject}`));

  if (visibleCheckins.length === 0) return null;

  return (
    <>
      <div className="space-y-2">
        <h4 className="text-xs font-medium text-muted-foreground flex items-center gap-1.5 uppercase tracking-wide">
          <Heart className="w-3.5 h-3.5 text-primary/60" />
          Gentle check-ins
        </h4>
        <div className="space-y-1.5">
          {visibleCheckins.map((ci, i) => {
            const key = `${ci.opportunity_id}:${ci.suggested_subject}`;
            return (
              <Card key={i} className="border-border/40">
                <CardContent className="p-3 flex items-start justify-between gap-2">
                  <div className="space-y-0.5 flex-1 min-w-0">
                    <p className="text-xs text-muted-foreground leading-relaxed">{ci.reason}</p>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs gap-1"
                      onClick={() => setEmailModal({ open: true, checkin: ci })}
                    >
                      <Mail className="w-3 h-3" />
                      Open email
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-1.5 text-muted-foreground"
                      onClick={() => {
                        dismissCheckin(key);
                        setDismissed(prev => [...prev, key]);
                      }}
                    >
                      <X className="w-3 h-3" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {emailModal.checkin && (
        <CheckInEmailModal
          open={emailModal.open}
          onOpenChange={(open) => setEmailModal({ open, checkin: open ? emailModal.checkin : null })}
          opportunityId={emailModal.checkin.opportunity_id}
          partnerName={entityName}
          subject={emailModal.checkin.suggested_subject}
          body={emailModal.checkin.suggested_body}
          reason={emailModal.checkin.reason}
        />
      )}
    </>
  );
}
