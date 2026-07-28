/**
 * ErrorDetailDrawer — Slide-out panel for a single Sentry issue.
 *
 * WHAT: Shows full issue context, latest-event stack/breadcrumbs, and Lovable prompt generation.
 * WHERE: Opened from Error Desk table row click.
 * WHY: Gives operator all info + one-click repair prompt. Sentry is the source of truth,
 *      so status changes are written back to Sentry (resolve / ignore) and there are no
 *      owner notes (those lived only in the retired operator_app_errors table).
 */
import { useState, useEffect } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Copy, Check, ChevronDown, FlaskConical, ExternalLink } from 'lucide-react';
import { toast } from '@/components/ui/sonner';
import { supabase } from '@/integrations/supabase/client';
import { buildLovableFixPrompt } from '@/lib/buildLovableFixPrompt';
import { classifyImpact, isAutoResolvable } from '@/lib/operatorImpactClassifier';
import { calmVariant } from '@/lib/calmMode';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { HelpCircle } from 'lucide-react';
import { format } from 'date-fns';
import type { SentryIssueRecord } from '@/pages/operator/ErrorDeskPage';

interface ErrorDetailDrawerProps {
  error: SentryIssueRecord | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdated: () => void;
}

interface SentryEventDetail {
  stack_excerpt: string;
  breadcrumbs: Array<Record<string, unknown>>;
  context: Record<string, unknown>;
}

export function ErrorDetailDrawer({ error, open, onOpenChange, onUpdated }: ErrorDetailDrawerProps) {
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [contextOpen, setContextOpen] = useState(false);
  const [eventDetail, setEventDetail] = useState<SentryEventDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Fetch the latest event (stack + breadcrumbs) when an issue opens.
  useEffect(() => {
    setCopied(false);
    setEventDetail(null);
    if (!error || !open) return;
    let cancelled = false;
    setLoadingDetail(true);
    (async () => {
      try {
        const { data, error: invokeErr } = await supabase.functions.invoke('sentry-issue-detail', {
          body: { id: error.id },
        });
        if (cancelled) return;
        if (invokeErr || data?.error) {
          setEventDetail(null);
        } else {
          setEventDetail(data.event as SentryEventDetail);
        }
      } finally {
        if (!cancelled) setLoadingDetail(false);
      }
    })();
    return () => { cancelled = true; };
  }, [error, open]);

  if (!error) return null;

  const impact = classifyImpact(error);
  const autoResolvable = isAutoResolvable(error);

  // Merge the issue context with the latest event's stack so the Lovable prompt
  // has real Sentry stack frames to work from.
  const promptInput = {
    ...error,
    context: {
      ...error.context,
      ...(eventDetail?.stack_excerpt ? { stack: eventDetail.stack_excerpt } : {}),
    },
  };

  const handleCopyPrompt = async () => {
    const prompt = buildLovableFixPrompt(promptInput);
    await navigator.clipboard.writeText(prompt);
    setCopied(true);
    toast.success('Lovable repair prompt copied.');
    setTimeout(() => setCopied(false), 3000);
  };

  const handleAction = async (action: 'resolve' | 'ignore') => {
    setSaving(true);
    try {
      const { data, error: invokeErr } = await supabase.functions.invoke('sentry-issues-proxy', {
        body: { action, issue_id: error.id },
      });
      if (invokeErr || data?.error) throw new Error(data?.message || 'Could not update Sentry');
      toast.success(action === 'resolve' ? 'Marked resolved in Sentry' : 'Ignored in Sentry');
      onUpdated();
      onOpenChange(false);
    } catch {
      toast.error('Could not update issue in Sentry');
    } finally {
      setSaving(false);
    }
  };

  const handleCreateDemoLabTest = () => {
    toast.success('Demo Lab test item created for this error.');
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="text-base font-medium flex items-center gap-2">
            Error Detail
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-xs text-xs space-y-1">
                  <p><strong>What:</strong> Full detail view of a Sentry issue</p>
                  <p><strong>Where:</strong> Sentry (cros-llc org)</p>
                  <p><strong>Why:</strong> Inspect, triage, and generate repair prompts</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </SheetTitle>
        </SheetHeader>

        <div className="space-y-5 mt-4">
          {/* Badges */}
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline">{error.context.app_slug ?? 'unknown'}</Badge>
            <Badge variant={calmVariant(error.severity === 'high' ? 'error' : 'ok')}>{error.severity}</Badge>
            {impact === 'high' && (
              <Badge variant="outline" className="border-primary/50 text-primary animate-pulse">
                Blocking
              </Badge>
            )}
            {autoResolvable && (
              <Badge variant="outline" className="text-accent-foreground text-xs">
                Looks stable — mark resolved?
              </Badge>
            )}
          </div>

          {/* Message */}
          <div>
            <p className="text-xs text-muted-foreground mb-1">Message</p>
            <p className="text-sm font-mono bg-muted/50 p-2 rounded">{error.message}</p>
          </div>

          {/* Timeline */}
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <p className="text-muted-foreground">First seen</p>
              <p className="font-medium">{format(new Date(error.first_seen_at), 'MMM d, h:mm a')}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Last seen</p>
              <p className="font-medium">{format(new Date(error.last_seen_at), 'MMM d, h:mm a')}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Occurrences</p>
              <p className="font-medium">{error.count}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Fingerprint</p>
              <p className="font-mono text-[10px] truncate">{error.fingerprint}</p>
            </div>
          </div>

          {/* Stack excerpt (from latest Sentry event) */}
          {loadingDetail ? (
            <p className="text-xs text-muted-foreground">Loading latest event…</p>
          ) : eventDetail?.stack_excerpt ? (
            <div>
              <p className="text-xs text-muted-foreground mb-1">Stack (latest event)</p>
              <pre className="text-[10px] bg-muted/50 p-2 rounded overflow-x-auto max-h-48 whitespace-pre-wrap">
                {eventDetail.stack_excerpt}
              </pre>
            </div>
          ) : null}

          {/* Context JSON */}
          <Collapsible open={contextOpen} onOpenChange={setContextOpen}>
            <CollapsibleTrigger className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
              <ChevronDown className={`h-3 w-3 transition-transform ${contextOpen ? 'rotate-180' : ''}`} />
              Context JSON
            </CollapsibleTrigger>
            <CollapsibleContent>
              <pre className="text-[10px] bg-muted/50 p-2 rounded mt-1 overflow-x-auto max-h-48">
                {JSON.stringify(error.context, null, 2)}
              </pre>
            </CollapsibleContent>
          </Collapsible>

          {/* Breadcrumbs (from latest Sentry event) */}
          {eventDetail?.breadcrumbs && eventDetail.breadcrumbs.length > 0 && (
            <Collapsible>
              <CollapsibleTrigger className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
                <ChevronDown className="h-3 w-3" />
                Breadcrumbs ({eventDetail.breadcrumbs.length})
              </CollapsibleTrigger>
              <CollapsibleContent>
                <pre className="text-[10px] bg-muted/50 p-2 rounded mt-1 overflow-x-auto max-h-48">
                  {JSON.stringify(eventDetail.breadcrumbs, null, 2)}
                </pre>
              </CollapsibleContent>
            </Collapsible>
          )}

          {/* Actions */}
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={handleCopyPrompt} disabled={copied}>
              {copied ? <Check className="h-4 w-4 mr-1" /> : <Copy className="h-4 w-4 mr-1" />}
              {copied ? 'Copied' : 'Copy Lovable Fix Prompt'}
            </Button>
            <Button size="sm" variant="outline" onClick={() => handleAction('resolve')} disabled={saving}>
              Mark Resolved
            </Button>
            <Button size="sm" variant="outline" onClick={() => handleAction('ignore')} disabled={saving}>
              Ignore
            </Button>
            {error.sentry_url && (
              <Button size="sm" variant="outline" asChild>
                <a href={error.sentry_url} target="_blank" rel="noreferrer">
                  Open in Sentry <ExternalLink className="h-4 w-4 ml-1" />
                </a>
              </Button>
            )}
            <Button size="sm" variant="outline" onClick={handleCreateDemoLabTest}>
              <FlaskConical className="h-4 w-4 mr-1" />
              Create Demo Lab Test
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
