import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useEventAttendees, useUpdateAttendee } from '@/hooks/useEventAttendees';
import { Star, Building2, TrendingUp, Target } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';

interface AttendeeTargetsListProps {
  eventId: string;
}

export function AttendeeTargetsList({ eventId }: AttendeeTargetsListProps) {
  const { data: attendees, isLoading } = useEventAttendees(eventId);
  const updateAttendee = useUpdateAttendee(eventId);
  
  const rankedAttendees = (attendees || [])
    .filter(a => a.target_score > 0 || a.is_target)
    .sort((a, b) => b.target_score - a.target_score);
  
  const handleToggleTarget = async (id: string, current: boolean) => {
    await updateAttendee.mutateAsync({ id, is_target: !current });
  };
  
  if (isLoading) {
    return <div className="text-center py-8 text-muted-foreground">Loading targets...</div>;
  }
  
  if (rankedAttendees.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <Target className="w-12 h-12 mx-auto mb-2 opacity-50" />
        <p>No ranked targets yet.</p>
        <p className="text-sm">Run "Rank Targets" in the Attendees tab first.</p>
      </div>
    );
  }
  
  return (
    <TooltipProvider>
      <ScrollArea className="h-[500px]">
        <div className="space-y-2 pr-4">
          {rankedAttendees.map((att, index) => (
            <Card key={att.id}>
              <CardContent className="p-4">
                <div className="flex items-start gap-4">
                  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary font-bold text-sm">
                    #{index + 1}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{att.raw_full_name}</span>
                      {att.is_target && <Star className="w-4 h-4 text-warning fill-warning" />}
                    </div>
                    
                    {att.raw_org && (
                      <div className="flex items-center gap-1 text-sm text-muted-foreground mt-1">
                        <Building2 className="w-3 h-3" />
                        {att.raw_org}
                      </div>
                    )}
                    
                    {att.raw_title && (
                      <p className="text-xs text-muted-foreground">{att.raw_title}</p>
                    )}
                    
                    {att.target_reasons.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {att.target_reasons.map((reason, i) => (
                          <Badge key={i} variant="outline" className="text-xs">
                            {reason}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                  
                  <div className="flex flex-col items-end gap-2">
                    <Tooltip>
                      <TooltipTrigger>
                        <Badge className="bg-primary/10 text-primary">
                          <TrendingUp className="w-3 h-3 mr-1" />
                          {att.target_score}
                        </Badge>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Target Score: {att.target_score}</p>
                      </TooltipContent>
                    </Tooltip>
                    
                    <Button
                      size="sm"
                      variant={att.is_target ? "default" : "outline"}
                      onClick={() => handleToggleTarget(att.id, att.is_target)}
                    >
                      <Star className={`w-3 h-3 mr-1 ${att.is_target ? 'fill-current' : ''}`} />
                      {att.is_target ? 'Target' : 'Mark'}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </ScrollArea>
    </TooltipProvider>
  );
}
