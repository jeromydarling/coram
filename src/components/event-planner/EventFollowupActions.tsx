import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Mail, Loader2, ChevronDown } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import { useCreateEventFollowupCampaign } from '@/hooks/useEventFollowupCampaign';

interface EventFollowupActionsProps {
  eventId: string;
  lastImportBatchId?: string | null;
  importBatchCount?: number;
  variant?: 'inline' | 'success-banner';
  audienceCount?: number;
}

const DEFAULT_SUBJECT_VARIANTS = [
  'Great meeting you at the event',
  'Following up from the event',
  'Quick follow-up from the event',
];

export function EventFollowupActions({
  eventId,
  lastImportBatchId,
  importBatchCount = 1,
  variant = 'inline',
  audienceCount,
}: EventFollowupActionsProps) {
  const createCampaign = useCreateEventFollowupCampaign();
  const [selectedSubjectIndex, setSelectedSubjectIndex] = useState(0);

  const handleCreate = (batchId?: string) => {
    createCampaign.mutate({
      event_id: eventId,
      import_batch_id: batchId || undefined,
      template_mode: 'company_kb',
      selected_subject_index: selectedSubjectIndex,
    });
  };

  if (variant === 'success-banner') {
    return (
      <div className="flex items-center gap-3 p-4 rounded-lg border bg-success/5 border-success/20">
        <Mail className="w-5 h-5 text-success shrink-0" />
        <div className="flex-1">
          <p className="text-sm font-medium">Import successful</p>
          {audienceCount !== undefined && (
            <p className="text-xs text-muted-foreground">{audienceCount} attendees imported</p>
          )}
        </div>
        <Button
          size="sm"
          onClick={() => handleCreate(lastImportBatchId || undefined)}
          disabled={createCampaign.isPending}
        >
          {createCampaign.isPending ? (
            <Loader2 className="w-4 h-4 animate-spin mr-1" />
          ) : (
            <Mail className="w-4 h-4 mr-1" />
          )}
          Email imported contacts
        </Button>
      </div>
    );
  }

  // Inline variant with dropdown for batch + subject selection
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" disabled={createCampaign.isPending} className="gap-2">
          {createCampaign.isPending ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Mail className="w-4 h-4" />
          )}
          Email attendees
          <ChevronDown className="w-3 h-3" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        {importBatchCount > 1 && lastImportBatchId ? (
          <>
            <DropdownMenuItem onClick={() => handleCreate(lastImportBatchId)}>
              Email last import
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleCreate()}>
              Email all attendees
            </DropdownMenuItem>
          </>
        ) : (
          <DropdownMenuItem onClick={() => handleCreate(lastImportBatchId || undefined)}>
            Email attendees (smart template)
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="text-xs text-muted-foreground font-normal">
          Subject line style
        </DropdownMenuLabel>
        {DEFAULT_SUBJECT_VARIANTS.map((label, idx) => (
          <DropdownMenuItem
            key={idx}
            className={selectedSubjectIndex === idx ? 'bg-accent' : ''}
            onClick={(e) => {
              e.preventDefault();
              setSelectedSubjectIndex(idx);
            }}
          >
            <span className="text-xs">{label}</span>
            {selectedSubjectIndex === idx && (
              <span className="ml-auto text-xs text-primary">✓</span>
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
