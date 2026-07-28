import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useGenerateConferencePlan, useUpdateConferencePlanItem, useGenerateEventFollowups } from '@/hooks/useEventAttendees';
import { Sparkles, Target, Check, X, Loader2, Building2 } from 'lucide-react';
import type { ConferencePlanItem } from '@/types/event-planner';
import { cn } from '@/lib/utils';

interface ConferencePlanPanelProps {
  event: {
    id: string;
    event_name: string;
    conference_plan_json?: ConferencePlanItem[] | unknown;
    conference_plan_generated_at?: string | null;
    attended?: boolean | null;
    status?: string | null;
  };
}

export function ConferencePlanPanel({ event }: ConferencePlanPanelProps) {
  const generatePlan = useGenerateConferencePlan(event.id);
  const updateItem = useUpdateConferencePlanItem(event.id);
  const generateFollowups = useGenerateEventFollowups(event.id);
  
  const planItems = Array.isArray(event.conference_plan_json) 
    ? event.conference_plan_json as ConferencePlanItem[]
    : [];
  
  const openItems = planItems.filter(i => i.status === 'open');
  const doneItems = planItems.filter(i => i.status === 'done');
  
  const handleStatusChange = (itemId: string, status: 'done' | 'dismissed') => {
    updateItem.mutate({ itemId, status });
  };
  
  const isEventCompleted = event.attended === true || event.status === 'Completed';
  
  return (
    <div className="space-y-4" data-tour="conference-plan">
      {/* Actions */}
      <div className="flex flex-wrap items-center gap-2">
        <Button 
          onClick={() => generatePlan.mutateAsync()}
          disabled={generatePlan.isPending}
          className="gap-2"
          data-tour="generate-plan"
        >
          {generatePlan.isPending ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Target className="w-4 h-4" />
          )}
          {planItems.length > 0 ? 'Regenerate Plan' : 'Generate Conference Plan'}
        </Button>
        
        {isEventCompleted && (
          <Button 
            variant="outline"
            onClick={() => generateFollowups.mutateAsync()}
            disabled={generateFollowups.isPending}
            className="gap-2"
          >
            {generateFollowups.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Sparkles className="w-4 h-4" />
            )}
            Generate Follow-ups
          </Button>
        )}
      </div>
      
      {/* Generated timestamp */}
      {event.conference_plan_generated_at && (
        <p className="text-xs text-muted-foreground">
          Generated: {new Date(event.conference_plan_generated_at).toLocaleString()}
        </p>
      )}
      
      {/* Plan items */}
      {planItems.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <Target className="w-12 h-12 mx-auto mb-2 opacity-50" />
          <p>No conference plan yet.</p>
          <p className="text-sm">Click "Generate Conference Plan" to create one.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Open items */}
          {openItems.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Target className="w-4 h-4 text-primary" />
                  Action Items ({openItems.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[300px]">
                  <div className="space-y-2 pr-4">
                    {openItems.map(item => (
                      <div key={item.id} className="flex items-start gap-3 p-3 border rounded-lg">
                        <Badge className="shrink-0 bg-primary/10 text-primary">
                          #{item.rank}
                        </Badge>
                        
                        <div className="flex-1 min-w-0">
                          <p className="font-medium">{item.attendee_name}</p>
                          {item.organization && (
                            <div className="flex items-center gap-1 text-sm text-muted-foreground">
                              <Building2 className="w-3 h-3" />
                              {item.organization}
                            </div>
                          )}
                          <p className="text-sm text-muted-foreground mt-1">
                            {item.recommended_action}
                          </p>
                          {item.reasons.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-2">
                              {item.reasons.map((r, i) => (
                                <Badge key={i} variant="outline" className="text-xs">{r}</Badge>
                              ))}
                            </div>
                          )}
                        </div>
                        
                        <div className="flex gap-1">
                          <Button 
                            size="sm" 
                            variant="ghost" 
                            onClick={() => handleStatusChange(item.id, 'done')}
                            data-tour="plan-item-action"
                          >
                            <Check className="w-4 h-4 text-success" data-tour="mark-done" />
                          </Button>
                          <Button 
                            size="sm" 
                            variant="ghost" 
                            onClick={() => handleStatusChange(item.id, 'dismissed')}
                          >
                            <X className="w-4 h-4 text-muted-foreground" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          )}
          
          {/* Done items */}
          {doneItems.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2 text-success">
                  <Check className="w-4 h-4" />
                  Completed ({doneItems.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-1">
                  {doneItems.map(item => (
                    <div key={item.id} className="flex items-center gap-2 text-sm text-muted-foreground line-through">
                      <span>#{item.rank}</span>
                      <span>{item.attendee_name}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
