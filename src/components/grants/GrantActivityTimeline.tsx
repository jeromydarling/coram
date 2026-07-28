import { format } from 'date-fns';
import { 
  Search, 
  Phone, 
  Users, 
  Pencil, 
  Send, 
  FileText,
  Plus,
  Calendar
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { GrantActivity, GrantActivityType } from '@/hooks/useGrantActivities';

interface GrantActivityTimelineProps {
  activities: GrantActivity[];
  onAddActivity?: () => void;
}

const activityIcons: Record<GrantActivityType, React.ReactNode> = {
  'Research': <Search className="w-4 h-4" />,
  'Call': <Phone className="w-4 h-4" />,
  'Meeting': <Users className="w-4 h-4" />,
  'Writing': <Pencil className="w-4 h-4" />,
  'Submission': <Send className="w-4 h-4" />,
  'Reporting': <FileText className="w-4 h-4" />
};

const activityColors: Record<GrantActivityType, string> = {
  'Research': 'bg-info/15 text-info',
  'Call': 'bg-warning/15 text-warning',
  'Meeting': 'bg-primary/15 text-primary',
  'Writing': 'bg-accent/15 text-accent',
  'Submission': 'bg-success/15 text-success',
  'Reporting': 'bg-chart-5/15 text-[hsl(var(--chart-5))]'
};

export function GrantActivityTimeline({ activities, onAddActivity }: GrantActivityTimelineProps) {
  if (activities.length === 0) {
    return (
      <div className="text-center py-8">
        <FileText className="w-12 h-12 text-muted-foreground/50 mx-auto mb-3" />
        <p className="text-muted-foreground mb-4">No activities logged yet</p>
        {onAddActivity && (
          <Button onClick={onAddActivity} variant="outline" size="sm">
            <Plus className="w-4 h-4 mr-2" />
            Log First Activity
          </Button>
        )}
      </div>
    );
  }
  
  return (
    <div className="space-y-4">
      {onAddActivity && (
        <div className="flex justify-end">
          <Button onClick={onAddActivity} size="sm" variant="outline">
            <Plus className="w-4 h-4 mr-2" />
            Log Activity
          </Button>
        </div>
      )}
      
      <div className="relative">
        {/* Timeline line */}
        <div className="absolute left-5 top-0 bottom-0 w-px bg-border" />
        
        {activities.map((activity, index) => (
          <div key={activity.id} className="relative flex gap-4 pb-6 last:pb-0">
            {/* Icon */}
            <div 
              className={cn(
                'relative z-10 flex items-center justify-center w-10 h-10 rounded-full',
                activityColors[activity.activity_type]
              )}
            >
              {activityIcons[activity.activity_type]}
            </div>
            
            {/* Content */}
            <div className="flex-1 pt-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="font-medium text-sm">{activity.activity_type}</span>
                <span className="text-xs text-muted-foreground">
                  {format(new Date(activity.activity_date), 'MMM d, yyyy')}
                </span>
              </div>
              
              {activity.notes && (
                <p className="text-sm text-muted-foreground mb-2">{activity.notes}</p>
              )}
              
              {activity.next_action && (
                <div className="flex items-center gap-2 text-xs">
                  <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                  <span className="text-muted-foreground">Next:</span>
                  <span>{activity.next_action}</span>
                  {activity.next_action_due && (
                    <span className="text-warning">
                      (Due {format(new Date(activity.next_action_due), 'MMM d')})
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
