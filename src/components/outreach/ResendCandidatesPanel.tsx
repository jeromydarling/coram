import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, RotateCcw, Search, Info } from 'lucide-react';
import { useResendCandidates, useRequeueCandidates } from '@/hooks/useResendCandidates';
import type { EmailCampaign } from '@/hooks/useEmailCampaigns';

interface ResendCandidatesPanelProps {
  campaignId: string;
  campaign: EmailCampaign;
}

export function ResendCandidatesPanel({ campaignId, campaign }: ResendCandidatesPanelProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const { data: candidates = [], isLoading, refetch, isFetched } = useResendCandidates(campaignId);
  const requeue = useRequeueCandidates();

  const canRequeue = !['draft', 'audience_ready'].includes(campaign.status);

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === candidates.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(candidates.map((c) => c.id)));
    }
  };

  const handleRequeue = () => {
    if (selected.size === 0) return;
    requeue.mutate(
      { campaignId, audienceIds: [...selected] },
      { onSuccess: () => { setSelected(new Set()); refetch(); } }
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <RotateCcw className="h-5 w-5" />
          Suggested Resend
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <Alert variant="default" className="bg-muted/50">
          <Info className="h-4 w-4" />
          <AlertDescription className="text-xs">
            Only transient failures (quota / temp / unknown) are eligible for resend.
            Permanent failures (invalid address, bounce) are excluded.
          </AlertDescription>
        </Alert>

        <Button
          variant="outline"
          size="sm"
          onClick={() => refetch()}
          disabled={isLoading}
        >
          {isLoading ? (
            <Loader2 className="h-4 w-4 mr-1 animate-spin" />
          ) : (
            <Search className="h-4 w-4 mr-1" />
          )}
          Find resend candidates
        </Button>

        {isFetched && candidates.length === 0 && (
          <p className="text-sm text-muted-foreground py-2">No eligible candidates found.</p>
        )}

        {candidates.length > 0 && (
          <>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={selected.size === candidates.length && candidates.length > 0}
                  onCheckedChange={toggleAll}
                />
                <span className="text-sm text-muted-foreground">
                  {selected.size} of {candidates.length} selected
                </span>
              </div>
              <Button
                size="sm"
                onClick={handleRequeue}
                disabled={selected.size === 0 || !canRequeue || requeue.isPending}
              >
                {requeue.isPending ? (
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                ) : (
                  <RotateCcw className="h-4 w-4 mr-1" />
                )}
                Requeue selected
              </Button>
            </div>

            <ScrollArea className="h-[300px]">
              <div className="space-y-1">
                {candidates.map((c) => (
                  <div
                    key={c.id}
                    className="flex items-center gap-3 p-2 rounded hover:bg-accent"
                  >
                    <Checkbox
                      checked={selected.has(c.id)}
                      onCheckedChange={() => toggleSelect(c.id)}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{c.name || c.email}</p>
                      {c.name && (
                        <p className="text-xs text-muted-foreground truncate">{c.email}</p>
                      )}
                    </div>
                    <Badge variant="outline" className="text-xs shrink-0">
                      {c.failure_category || 'unknown'}
                    </Badge>
                    {c.error_message && (
                      <span
                        className="text-xs text-destructive truncate max-w-[100px]"
                        title={c.error_message}
                      >
                        {c.error_message}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </ScrollArea>
          </>
        )}
      </CardContent>
    </Card>
  );
}
