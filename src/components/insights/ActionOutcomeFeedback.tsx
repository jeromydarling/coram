import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ThumbsUp, ThumbsDown, Clock, Loader2 } from 'lucide-react';
import { useRecordOutcome, type OutcomeType } from '@/hooks/useActionOutcomes';

interface ActionOutcomeFeedbackProps {
  actionId: string;
  orgId: string;
  alreadyRecorded?: boolean;
  existingOutcome?: OutcomeType;
}

const OUTCOME_BUTTONS: { type: OutcomeType; icon: typeof ThumbsUp; label: string; title: string }[] = [
  { type: 'successful', icon: ThumbsUp, label: '👍', title: 'Helpful' },
  { type: 'unsuccessful', icon: ThumbsDown, label: '👎', title: 'Not helpful' },
  { type: 'needs_followup', icon: Clock, label: '🕒', title: 'Follow up later' },
];

export function ActionOutcomeFeedback({
  actionId,
  orgId,
  alreadyRecorded,
  existingOutcome,
}: ActionOutcomeFeedbackProps) {
  const recordOutcome = useRecordOutcome();
  const [showNotes, setShowNotes] = useState(false);
  const [notes, setNotes] = useState('');
  const [selectedType, setSelectedType] = useState<OutcomeType | null>(null);

  if (alreadyRecorded && existingOutcome) {
    const match = OUTCOME_BUTTONS.find((b) => b.type === existingOutcome);
    return (
      <span className="text-xs text-muted-foreground italic">
        {match ? `${match.label} ${match.title}` : existingOutcome}
      </span>
    );
  }

  if (alreadyRecorded) {
    return <span className="text-xs text-muted-foreground italic">Feedback recorded</span>;
  }

  const handleSubmit = (type: OutcomeType) => {
    recordOutcome.mutate({
      actionId,
      orgId,
      outcomeType: type,
      notes: notes || undefined,
    });
  };

  if (showNotes && selectedType) {
    return (
      <div className="flex items-center gap-1">
        <Input
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Notes (optional)"
          className="h-6 text-xs w-28"
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSubmit(selectedType);
          }}
        />
        <Button
          size="sm"
          variant="outline"
          className="h-6 text-xs px-2"
          disabled={recordOutcome.isPending}
          onClick={() => handleSubmit(selectedType)}
        >
          {recordOutcome.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Save'}
        </Button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-0.5">
      {OUTCOME_BUTTONS.map(({ type, label, title }) => (
        <Button
          key={type}
          size="sm"
          variant="ghost"
          className="h-6 w-6 p-0 text-xs"
          title={title}
          disabled={recordOutcome.isPending}
          onClick={() => {
            setSelectedType(type);
            setShowNotes(true);
          }}
        >
          {label}
        </Button>
      ))}
    </div>
  );
}
