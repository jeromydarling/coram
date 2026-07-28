/**
 * FrictionDesignSuggestionsPanel — Design Suggestions stream for Crescere Zone.
 *
 * WHAT: Lists open NRI design suggestions with actions: Copy Fix Prompt, Mark Reviewed, Dismiss.
 * WHERE: Embedded in OperatorSignumPage (/operator/nexus/friction).
 * WHY: Operators see where the system could become gentler, with one-click engineering prompts.
 */

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from '@/components/ui/sonner';
import { useDesignSuggestions, useUpdateDesignSuggestion, useRunFrictionInsights, type DesignSuggestion } from '@/hooks/useFrictionInsights';
import { buildFrictionFixPrompt } from '@/lib/buildFrictionFixPrompt';
import { Sparkles, Copy, CheckCircle, XCircle, Eye, Loader2 } from 'lucide-react';
import { HelpTooltip } from '@/components/ui/help-tooltip';
const SectionTooltip = HelpTooltip;

const severityColors: Record<string, string> = {
  low: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  medium: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  high: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
};

export function FrictionDesignSuggestionsPanel() {
  const [statusFilter, setStatusFilter] = useState('open');
  const [severityFilter, setSeverityFilter] = useState('all');
  const [detailSuggestion, setDetailSuggestion] = useState<DesignSuggestion | null>(null);

  const { data: suggestions, isLoading } = useDesignSuggestions({
    status: statusFilter,
    severity: severityFilter,
  });
  const updateMutation = useUpdateDesignSuggestion();
  const runInsights = useRunFrictionInsights();

  const handleCopyPrompt = (suggestion: DesignSuggestion) => {
    const prompt = buildFrictionFixPrompt(suggestion);
    navigator.clipboard.writeText(prompt);
    toast.success('Lovable fix prompt copied to clipboard');
  };

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-muted-foreground" />
              <CardTitle className="text-base font-serif">Design Suggestions</CardTitle>
              <SectionTooltip
                what="NRI-generated UX improvement suggestions from friction patterns."
                where="nri_design_suggestions"
                why="Transforms clean friction into actionable design improvements."
              />
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => runInsights.mutate({})}
              disabled={runInsights.isPending}
            >
              {runInsights.isPending ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Sparkles className="w-3 h-3 mr-1" />}
              Run Insights
            </Button>
          </div>
          <CardDescription>NRI noticed moments where people hesitate — no blame, no urgency.</CardDescription>
          <div className="flex gap-2 mt-2">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[130px] h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="open">Open</SelectItem>
                <SelectItem value="reviewed">Reviewed</SelectItem>
                <SelectItem value="implemented">Implemented</SelectItem>
                <SelectItem value="dismissed">Dismissed</SelectItem>
              </SelectContent>
            </Select>
            <Select value={severityFilter} onValueChange={setSeverityFilter}>
              <SelectTrigger className="w-[120px] h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Severity</SelectItem>
                <SelectItem value="low">Low</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="high">High</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-16" />
              <Skeleton className="h-16" />
            </div>
          ) : !suggestions || suggestions.length === 0 ? (
            <p className="text-sm text-muted-foreground italic py-4 text-center">
              No design suggestions yet — that is perfectly fine. Run insights to scan for friction patterns.
            </p>
          ) : (
            <div className="space-y-3">
              {suggestions.map((s) => (
                <div
                  key={s.id}
                  className="border rounded-lg p-3 space-y-2 hover:border-primary/20 transition-colors"
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm text-foreground leading-snug flex-1">{s.suggestion_summary}</p>
                    <Badge className={`text-xs shrink-0 ${severityColors[s.severity] || ''}`}>
                      {s.severity}
                    </Badge>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {s.affected_routes.map((r) => (
                      <Badge key={r} variant="outline" className="text-[10px] font-mono">{r}</Badge>
                    ))}
                    {s.roles_affected.map((r) => (
                      <Badge key={r} variant="secondary" className="text-[10px]">{r}</Badge>
                    ))}
                  </div>
                  <div className="flex gap-1.5 pt-1">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs"
                      onClick={() => handleCopyPrompt(s)}
                    >
                      <Copy className="w-3 h-3 mr-1" /> Copy Fix Prompt
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 text-xs"
                      onClick={() => setDetailSuggestion(s)}
                    >
                      <Eye className="w-3 h-3 mr-1" /> Detail
                    </Button>
                    {s.status === 'open' && (
                      <>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 text-xs"
                          onClick={() => updateMutation.mutate({ id: s.id, status: 'reviewed' })}
                          disabled={updateMutation.isPending}
                        >
                          <CheckCircle className="w-3 h-3 mr-1" /> Reviewed
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 text-xs text-muted-foreground"
                          onClick={() => updateMutation.mutate({ id: s.id, status: 'dismissed' })}
                          disabled={updateMutation.isPending}
                        >
                          <XCircle className="w-3 h-3 mr-1" /> Dismiss
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Detail Dialog */}
      <Dialog open={!!detailSuggestion} onOpenChange={() => setDetailSuggestion(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="font-serif text-lg">Design Suggestion Detail</DialogTitle>
          </DialogHeader>
          {detailSuggestion && (
            <ScrollArea className="max-h-[60vh]">
              <div className="space-y-4 pr-4">
                <div>
                  <p className="text-sm font-medium text-foreground">{detailSuggestion.suggestion_summary}</p>
                  <p className="text-xs text-muted-foreground mt-1">Pattern: {detailSuggestion.pattern_key}</p>
                </div>
                <div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap text-sm text-muted-foreground">
                  {detailSuggestion.narrative_detail}
                </div>
                <div>
                  <p className="text-xs font-medium text-foreground mb-1">Evidence</p>
                  <pre className="text-[11px] bg-muted p-2 rounded overflow-auto max-h-40">
                    {JSON.stringify(detailSuggestion.evidence, null, 2)}
                  </pre>
                </div>
                <Button
                  size="sm"
                  onClick={() => handleCopyPrompt(detailSuggestion)}
                >
                  <Copy className="w-3 h-3 mr-1" /> Copy Lovable Fix Prompt
                </Button>
              </div>
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
