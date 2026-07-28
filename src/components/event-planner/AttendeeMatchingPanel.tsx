import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  useEventAttendees, 
  useImportAttendees, 
  useRunAttendeeMatching, 
  useRankTargets,
  useUpdateAttendee,
  useCreateContactFromAttendee,
  useBulkCreateContactsFromAttendees,
} from '@/hooks/useEventAttendees';
import { AttendeeImportModal } from './AttendeeImportModal';
import { AttendeeMatchCard } from './AttendeeMatchCard';
import { EventFollowupActions } from './EventFollowupActions';
import { Upload, RefreshCw, Target, Loader2, UserPlus } from 'lucide-react';
import type { AttendeeImportRow } from '@/types/event-planner';

interface AttendeeMatchingPanelProps {
  eventId: string;
}

export function AttendeeMatchingPanel({ eventId }: AttendeeMatchingPanelProps) {
  const [importOpen, setImportOpen] = useState(false);
  const [lastImportResult, setLastImportResult] = useState<{ count: number; import_batch_id: string | null } | null>(null);
  const [creatingAttendeeId, setCreatingAttendeeId] = useState<string | null>(null);
  const { data: attendees, isLoading } = useEventAttendees(eventId);
  const importAttendees = useImportAttendees(eventId);
  const runMatching = useRunAttendeeMatching(eventId);
  const rankTargets = useRankTargets(eventId);
  const updateAttendee = useUpdateAttendee(eventId);
  const createContactFromAttendee = useCreateContactFromAttendee(eventId);
  const bulkCreateContacts = useBulkCreateContactsFromAttendees(eventId);

  // Count distinct import batches
  const importBatchIds = new Set(
    (attendees || [])
      .map(a => (a as any).import_batch_id)
      .filter(Boolean)
  );
  const importBatchCount = importBatchIds.size;
  const lastBatchId = lastImportResult?.import_batch_id || 
    (importBatchIds.size > 0 ? [...importBatchIds].pop() : null);
  
  const matched = attendees?.filter(a => a.match_status === 'matched') || [];
  const possible = attendees?.filter(a => a.match_status === 'possible') || [];
  const newAttendees = attendees?.filter(a => a.match_status === 'new' || a.match_status === 'unmatched') || [];
  const dismissed = attendees?.filter(a => a.match_status === 'dismissed') || [];
  
  const handleImport = async (rows: AttendeeImportRow[]) => {
    const result = await importAttendees.mutateAsync(rows);
    setLastImportResult(result);
    // Auto-run matching after import
    await runMatching.mutateAsync();
  };
  
  const handleConfirmMatch = async (attendeeId: string) => {
    await updateAttendee.mutateAsync({
      id: attendeeId,
      match_status: 'matched',
    });
  };
  
  const handleRejectMatch = async (attendeeId: string) => {
    await updateAttendee.mutateAsync({
      id: attendeeId,
      match_status: 'new',
      matched_contact_id: null,
      matched_opportunity_id: null,
    });
  };
  
  const handleToggleTarget = async (attendeeId: string, currentValue: boolean) => {
    await updateAttendee.mutateAsync({
      id: attendeeId,
      is_target: !currentValue,
    });
  };
  
  const handleDismiss = async (attendeeId: string) => {
    await updateAttendee.mutateAsync({
      id: attendeeId,
      match_status: 'dismissed',
    });
  };
  
  const handleRestore = async (attendeeId: string) => {
    await updateAttendee.mutateAsync({
      id: attendeeId,
      match_status: 'new',
    });
  };
  
  const handleConfirmAllHighConfidence = async () => {
    const highConfidence = possible.filter(a => a.confidence_score >= 0.8);
    for (const att of highConfidence) {
      await updateAttendee.mutateAsync({
        id: att.id,
        match_status: 'matched',
      });
    }
  };
  
  const isProcessing = importAttendees.isPending || runMatching.isPending || rankTargets.isPending;
  
  return (
    <div className="space-y-4">
      {/* Post-import success banner */}
      {lastImportResult && lastImportResult.count > 0 && (
        <EventFollowupActions
          eventId={eventId}
          lastImportBatchId={lastImportResult.import_batch_id}
          variant="success-banner"
          audienceCount={lastImportResult.count}
        />
      )}

      {/* Actions */}
      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={() => setImportOpen(true)} className="gap-2">
          <Upload className="w-4 h-4" />
          Import Attendees
        </Button>
        
        <Button 
          variant="outline" 
          onClick={() => runMatching.mutateAsync()}
          disabled={isProcessing || !attendees?.length}
          className="gap-2"
        >
          {runMatching.isPending ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <RefreshCw className="w-4 h-4" />
          )}
          Run Matching
        </Button>
        
        <Button 
          variant="outline" 
          onClick={() => rankTargets.mutateAsync()}
          disabled={isProcessing || !attendees?.length}
          className="gap-2"
        >
          {rankTargets.isPending ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Target className="w-4 h-4" />
          )}
          Rank Targets
        </Button>

        {/* Email attendees button */}
        {(attendees?.length || 0) > 0 && (
          <EventFollowupActions
            eventId={eventId}
            lastImportBatchId={lastBatchId as string | null}
            importBatchCount={importBatchCount}
            variant="inline"
          />
        )}
      </div>
      
      {/* Tabs */}
      <Tabs defaultValue="possible">
        <TabsList>
          <TabsTrigger value="matched" className="gap-2">
            Matched
            <Badge variant="secondary" className="ml-1">{matched.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="possible" className="gap-2">
            Possible
            <Badge variant="secondary" className="ml-1">{possible.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="new" className="gap-2">
            New
            <Badge variant="secondary" className="ml-1">{newAttendees.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="dismissed" className="gap-2">
            Dismissed
            <Badge variant="secondary" className="ml-1">{dismissed.length}</Badge>
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="matched" className="mt-4">
          {matched.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">No confirmed matches yet</p>
          ) : (
            <ScrollArea className="h-[400px]">
              <div className="space-y-2 pr-4">
                {matched.map(att => (
                  <AttendeeMatchCard 
                    key={att.id} 
                    attendee={att}
                    onToggleTarget={() => handleToggleTarget(att.id, att.is_target)}
                    showActions={true}
                  />
                ))}
              </div>
            </ScrollArea>
          )}
        </TabsContent>
        
        <TabsContent value="possible" className="mt-4">
          {possible.length > 0 && (
            <div className="mb-4">
              <Button 
                variant="outline" 
                size="sm"
                onClick={handleConfirmAllHighConfidence}
                disabled={!possible.some(a => a.confidence_score >= 0.8)}
              >
                Confirm All High-Confidence (≥80%)
              </Button>
            </div>
          )}
          
          {possible.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">No possible matches found</p>
          ) : (
            <ScrollArea className="h-[400px]">
              <div className="space-y-2 pr-4">
                {possible.map(att => (
                  <AttendeeMatchCard 
                    key={att.id} 
                    attendee={att}
                    onConfirmMatch={() => handleConfirmMatch(att.id)}
                    onRejectMatch={() => handleRejectMatch(att.id)}
                    onToggleTarget={() => handleToggleTarget(att.id, att.is_target)}
                  />
                ))}
              </div>
            </ScrollArea>
          )}
        </TabsContent>
        
        <TabsContent value="new" className="mt-4">
          {newAttendees.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">No new attendees</p>
          ) : (
            <>
              <div className="mb-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => bulkCreateContacts.mutateAsync(newAttendees)}
                  disabled={bulkCreateContacts.isPending || newAttendees.length === 0}
                  className="gap-1"
                >
                  {bulkCreateContacts.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <UserPlus className="w-4 h-4" />
                  )}
                  Create All as Contacts ({newAttendees.length})
                </Button>
              </div>
              <ScrollArea className="h-[400px]">
                <div className="space-y-2 pr-4">
                  {newAttendees.map(att => (
                    <AttendeeMatchCard 
                      key={att.id} 
                      attendee={att}
                      onToggleTarget={() => handleToggleTarget(att.id, att.is_target)}
                      onDismiss={() => handleDismiss(att.id)}
                      onCreateContact={() => {
                        setCreatingAttendeeId(att.id);
                        createContactFromAttendee.mutateAsync(att).finally(() => setCreatingAttendeeId(null));
                      }}
                      isCreatingContact={creatingAttendeeId === att.id}
                    />
                  ))}
                </div>
              </ScrollArea>
            </>
          )}
        </TabsContent>
        
        <TabsContent value="dismissed" className="mt-4">
          {dismissed.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">No dismissed attendees</p>
          ) : (
            <ScrollArea className="h-[400px]">
              <div className="space-y-2 pr-4">
                {dismissed.map(att => (
                  <AttendeeMatchCard 
                    key={att.id} 
                    attendee={att}
                    onRestore={() => handleRestore(att.id)}
                  />
                ))}
              </div>
            </ScrollArea>
          )}
        </TabsContent>
      </Tabs>
      
      <AttendeeImportModal
        open={importOpen}
        onOpenChange={setImportOpen}
        onImport={handleImport}
        isLoading={importAttendees.isPending}
      />
    </div>
  );
}
