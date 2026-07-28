import { useState } from 'react';
import { useContactCallHistory, CallHistoryItem } from '@/hooks/useContactCallHistory';
import { useQueryClient } from '@tanstack/react-query';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Phone, Plus, Pencil } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { CallModal } from '@/components/contacts/CallModal';
import { useTranslation } from 'react-i18next';

interface ContactCallsPanelProps {
  contactId: string;
  contactName: string;
  opportunityId?: string | null;
  metroId?: string | null;
  className?: string;
}

function CallItem({
  call,
  onEdit
}: {
  call: CallHistoryItem;
  onEdit: (call: CallHistoryItem) => void;
}) {
  const { t } = useTranslation('relationships');

  const outcomeColors: Record<string, string> = {
    'Positive': 'bg-success/20 text-success',
    'Neutral': 'bg-muted text-muted-foreground',
    'Negative': 'bg-destructive/20 text-destructive',
    'No Answer': 'bg-warning/20 text-warning'
  };

  return (
    <div
      className="flex items-start gap-3 py-2 px-3 rounded-md bg-muted/30 hover:bg-muted/50 transition-colors cursor-pointer group"
      onClick={() => onEdit(call)}
    >
      <div className="mt-0.5">
        <Phone className="w-4 h-4 text-muted-foreground" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm truncate">
            {call.notes ? call.notes.substring(0, 50) + (call.notes.length > 50 ? '...' : '') : t('interactions.calls.callLogged')}
          </span>
          {call.outcome && (
            <Badge
              variant="secondary"
              className={cn("text-xs shrink-0", outcomeColors[call.outcome] || '')}
            >
              {call.outcome}
            </Badge>
          )}
          <Pencil className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
        </div>
        <div className="text-xs text-muted-foreground mt-0.5">
          {format(new Date(call.date), 'MMM d, yyyy')} at {format(new Date(call.date), 'h:mm a')}
        </div>
        {call.next_action && (
          <div className="text-xs text-primary mt-1">
            {t('interactions.calls.next', { action: call.next_action })}
            {call.next_action_due && ` ${t('interactions.calls.nextDue', { date: format(new Date(call.next_action_due), 'MMM d') })}`}
          </div>
        )}
      </div>
    </div>
  );
}

export function ContactCallsPanel({
  contactId,
  contactName,
  opportunityId,
  metroId,
  className
}: ContactCallsPanelProps) {
  const { t } = useTranslation(['relationships', 'common']);
  const { data: calls, isLoading, error } = useContactCallHistory(contactId);
  const queryClient = useQueryClient();
  const [isCallModalOpen, setIsCallModalOpen] = useState(false);
  const [editingCall, setEditingCall] = useState<CallHistoryItem | null>(null);

  const handleAddCall = () => {
    setEditingCall(null);
    setIsCallModalOpen(true);
  };

  const handleEditCall = (call: CallHistoryItem) => {
    setEditingCall(call);
    setIsCallModalOpen(true);
  };

  const handleModalClose = () => {
    setIsCallModalOpen(false);
    setEditingCall(null);
    // Refresh call history
    queryClient.invalidateQueries({ queryKey: ['contact-call-history', contactId] });
  };

  if (isLoading) {
    return (
      <div className={cn("space-y-3", className)}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Phone className="w-4 h-4" />
            {t('relationships:interactions.calls.title')}
          </div>
        </div>
        <div className="space-y-2">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={cn("space-y-3", className)}>
        <div className="flex items-center gap-2 text-sm font-medium">
          <Phone className="w-4 h-4" />
          {t('relationships:interactions.calls.title')}
        </div>
        <p className="text-sm text-muted-foreground">{t('relationships:interactions.calls.failedToLoad')}</p>
      </div>
    );
  }

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Phone className="w-4 h-4" />
          {t('relationships:interactions.calls.title')}
          {calls && calls.length > 0 && (
            <span className="text-muted-foreground">({calls.length})</span>
          )}
        </div>
        <Button
          variant="outline"
          size="sm"
          className="h-7 gap-1.5"
          onClick={handleAddCall}
        >
          <Plus className="w-3.5 h-3.5" />
          {t('relationships:interactions.calls.logCall')}
        </Button>
      </div>

      {!calls || calls.length === 0 ? (
        <p className="text-sm text-muted-foreground py-2">
          {t('relationships:interactions.calls.noCalls')}
        </p>
      ) : (
        <div className="space-y-1.5 max-h-[200px] overflow-y-auto">
          {calls.map((call) => (
            <CallItem
              key={call.id}
              call={call}
              onEdit={handleEditCall}
            />
          ))}
        </div>
      )}

      <CallModal
        open={isCallModalOpen}
        onOpenChange={handleModalClose}
        contactId={contactId}
        contactName={contactName}
        opportunityId={opportunityId}
        metroId={metroId}
        existingCall={editingCall}
      />
    </div>
  );
}
