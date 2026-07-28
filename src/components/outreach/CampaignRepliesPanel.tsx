import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, MessageSquare, ThumbsUp, Minus, ThumbsDown } from 'lucide-react';
import { useCampaignReplies, useAcknowledgeReply, type ReplyOutcome } from '@/hooks/useOutreachReplies';
import { format, parseISO } from 'date-fns';

interface CampaignRepliesPanelProps {
  campaignId: string;
}

const outcomeConfig: Record<ReplyOutcome, { icon: React.ElementType; label: string; variant: 'default' | 'secondary' | 'destructive' }> = {
  useful: { icon: ThumbsUp, label: 'Useful', variant: 'default' },
  neutral: { icon: Minus, label: 'Neutral', variant: 'secondary' },
  not_useful: { icon: ThumbsDown, label: 'Not Useful', variant: 'destructive' },
};

export function CampaignRepliesPanel({ campaignId }: CampaignRepliesPanelProps) {
  const { data: replies, isLoading } = useCampaignReplies(campaignId);
  const acknowledge = useAcknowledgeReply();

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex justify-center py-8">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5" />
          Replies
          <Badge variant="secondary" className="ml-auto">{replies?.length || 0}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {!replies?.length ? (
          <p className="text-sm text-muted-foreground text-center py-6">
            No replies detected yet. Replies are matched during Gmail sync.
          </p>
        ) : (
          <div className="space-y-3 max-h-[500px] overflow-y-auto">
            {replies.map((reply) => (
              <div key={reply.id} className="border rounded-lg p-3 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">
                      Reply received {format(parseISO(reply.received_at), 'MMM d, yyyy h:mm a')}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Thread: {reply.thread_id.slice(0, 12)}...
                    </p>
                  </div>
                  {reply.outcome && (
                    <Badge variant={outcomeConfig[reply.outcome].variant}>
                      {outcomeConfig[reply.outcome].label}
                    </Badge>
                  )}
                </div>

                {!reply.outcome && (
                  <div className="flex gap-1.5 pt-1">
                    <p className="text-xs text-muted-foreground mr-2 self-center">Rate this reply:</p>
                    {(Object.keys(outcomeConfig) as ReplyOutcome[]).map((outcome) => {
                      const config = outcomeConfig[outcome];
                      const Icon = config.icon;
                      return (
                        <Button
                          key={outcome}
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs gap-1"
                          disabled={acknowledge.isPending}
                          onClick={() => acknowledge.mutate({ replyId: reply.id, outcome })}
                        >
                          <Icon className="w-3 h-3" />
                          {config.label}
                        </Button>
                      );
                    })}
                  </div>
                )}

                {reply.acknowledged_at && (
                  <p className="text-xs text-muted-foreground">
                    Acknowledged {format(parseISO(reply.acknowledged_at), 'MMM d h:mm a')}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
