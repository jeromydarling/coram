import { useFeedbackAuditLog } from '@/hooks/useFeedbackAuditLog';
import { useUsers } from '@/hooks/useUsers';
import { ScrollArea } from '@/components/ui/scroll-area';
import { History, ArrowRight, FileText, Plus } from 'lucide-react';
import { format } from 'date-fns';

interface FeedbackAuditTrailProps {
  feedbackId: string;
}

const actionLabels: Record<string, { label: string; icon: React.ReactNode }> = {
  created: { label: 'Created', icon: <Plus className="w-3 h-3" /> },
  status_changed: { label: 'Status changed', icon: <ArrowRight className="w-3 h-3" /> },
  notes_updated: { label: 'Notes updated', icon: <FileText className="w-3 h-3" /> },
};

export function FeedbackAuditTrail({ feedbackId }: FeedbackAuditTrailProps) {
  const { data: auditLog = [], isLoading } = useFeedbackAuditLog(feedbackId);
  const { data: users = [] } = useUsers();

  const getUserName = (userId: string) => {
    const user = users.find((u) => u.id === userId);
    return user?.display_name || 'Unknown User';
  };

  const formatStatusLabel = (status: string) => {
    return status
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase());
  };

  if (isLoading) {
    return (
      <div className="text-sm text-muted-foreground py-2">
        Loading activity...
      </div>
    );
  }

  if (auditLog.length === 0) {
    return (
      <div className="text-sm text-muted-foreground py-2">
        No activity recorded yet.
      </div>
    );
  }

  return (
    <ScrollArea className="h-[200px] pr-4">
      <div className="space-y-3">
        {auditLog.map((entry) => {
          const actionConfig = actionLabels[entry.action] || { 
            label: entry.action, 
            icon: <History className="w-3 h-3" /> 
          };

          return (
            <div key={entry.id} className="flex gap-3 text-sm">
              <div className="flex-shrink-0 w-5 h-5 rounded-full bg-muted flex items-center justify-center mt-0.5">
                {actionConfig.icon}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium">{getUserName(entry.performed_by)}</span>
                  <span className="text-muted-foreground">{actionConfig.label}</span>
                </div>
                {entry.action === 'status_changed' && entry.previous_value && entry.new_value && (
                  <div className="text-muted-foreground mt-0.5 flex items-center gap-1">
                    <span className="px-1.5 py-0.5 bg-muted rounded text-xs">
                      {formatStatusLabel(entry.previous_value)}
                    </span>
                    <ArrowRight className="w-3 h-3" />
                    <span className="px-1.5 py-0.5 bg-muted rounded text-xs">
                      {formatStatusLabel(entry.new_value)}
                    </span>
                  </div>
                )}
                {entry.action === 'notes_updated' && entry.new_value && (
                  <div className="text-muted-foreground mt-0.5 text-xs truncate">
                    "{entry.new_value}"
                  </div>
                )}
                {entry.action === 'created' && entry.new_value && (
                  <div className="text-muted-foreground mt-0.5 text-xs">
                    {entry.new_value}
                  </div>
                )}
                <div className="text-xs text-muted-foreground mt-1">
                  {format(new Date(entry.created_at), 'MMM d, yyyy h:mm a')}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </ScrollArea>
  );
}
