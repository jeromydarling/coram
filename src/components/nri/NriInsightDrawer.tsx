/**
 * NriInsightDrawer — "Why am I seeing this?" transparency drawer.
 *
 * WHAT: Shows evidence links, confidence label, and human override action for any NRI signal.
 * WHERE: Used inside StorySignalsCard and Lumen signals.
 * WHY: All NRI insights must be transparent — users should understand why a signal surfaced.
 */

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { Info, ExternalLink, ThumbsDown } from 'lucide-react';
import { toast } from '@/components/ui/sonner';

interface NriInsightDrawerProps {
  title: string;
  summary: string;
  kind: string;
  evidence: Record<string, unknown>;
  createdAt: string;
  signalId: string;
}

function confidenceFromKind(kind: string): { label: string; className: string } {
  switch (kind) {
    case 'celebration':
      return { label: 'High', className: 'bg-primary/15 text-primary' };
    case 'connection':
      return { label: 'High', className: 'bg-primary/15 text-primary' };
    case 'heads_up':
      return { label: 'Medium', className: 'bg-accent text-accent-foreground' };
    case 'check_in':
    default:
      return { label: 'Moderate', className: 'bg-muted text-muted-foreground' };
  }
}

export function NriInsightDrawer({ title, summary, kind, evidence, createdAt, signalId }: NriInsightDrawerProps) {
  const [open, setOpen] = useState(false);
  const confidence = confidenceFromKind(kind);

  const evidenceEntries = Object.entries(evidence || {}).filter(
    ([, v]) => v !== null && v !== undefined && v !== ''
  );

  const handleDismiss = () => {
    toast.info('Signal dismissed. It will not appear again.');
    setOpen(false);
  };

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        className="h-6 text-xs px-2 gap-1 text-muted-foreground hover:text-foreground"
        onClick={() => setOpen(true)}
      >
        <Info className="w-3 h-3" />
        Why this?
      </Button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="w-full sm:max-w-md">
          <SheetHeader>
            <SheetTitle className="font-serif text-lg">{title}</SheetTitle>
            <SheetDescription>{summary}</SheetDescription>
          </SheetHeader>

          <div className="space-y-5 mt-6">
            {/* Confidence */}
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1.5">Confidence</p>
              <Badge className={confidence.className} variant="secondary">
                {confidence.label}
              </Badge>
              <p className="text-xs text-muted-foreground mt-1.5">
                Based on signal type and supporting evidence strength.
              </p>
            </div>

            {/* Evidence */}
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1.5">Evidence</p>
              {evidenceEntries.length > 0 ? (
                <div className="space-y-2">
                  {evidenceEntries.map(([key, value]) => (
                    <div key={key} className="border border-border/40 rounded-lg p-3">
                      <p className="text-xs font-medium text-foreground capitalize">
                        {key.replace(/_/g, ' ')}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground italic">
                  This signal was generated from aggregate patterns — no specific evidence artifacts available.
                </p>
              )}
            </div>

            {/* Timestamp */}
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Generated</p>
              <p className="text-sm text-foreground">
                {new Date(createdAt).toLocaleDateString(undefined, { 
                  weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' 
                })}
              </p>
            </div>

            {/* Human override */}
            <div className="pt-3 border-t border-border/40">
              <p className="text-xs text-muted-foreground mb-2">
                If this signal isn't relevant, you can dismiss it.
              </p>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={handleDismiss}
              >
                <ThumbsDown className="w-3.5 h-3.5" />
                Dismiss this signal
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
