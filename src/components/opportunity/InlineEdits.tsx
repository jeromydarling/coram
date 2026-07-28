import { useState } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Check, X, Pencil } from 'lucide-react';
import { useUpdateOpportunity } from '@/hooks/useOpportunities';
import { cn } from '@/lib/utils';

import { CHAPTERS, toChapterLabel } from '@/lib/journeyChapters';

const STAGES = CHAPTERS;

interface InlineStageEditProps {
  opportunityId: string;
  currentStage: string;
  className?: string;
}

export function InlineStageEdit({ opportunityId, currentStage, className }: InlineStageEditProps) {
  const [isEditing, setIsEditing] = useState(false);
  const updateOpportunity = useUpdateOpportunity();

  const handleChange = async (newStage: string) => {
    if (newStage === currentStage) {
      setIsEditing(false);
      return;
    }
    await updateOpportunity.mutateAsync({ id: opportunityId, stage: newStage as any });
    setIsEditing(false);
  };

  if (isEditing) {
    return (
      <div className="inline-flex" onClick={(e) => e.stopPropagation()}>
        <Select value={currentStage} onValueChange={handleChange}>
          <SelectTrigger className="h-7 text-xs w-auto min-w-[140px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STAGES.map((s) => (
              <SelectItem key={s} value={s} className="text-xs">
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0 ml-1"
          onClick={(e) => { e.stopPropagation(); setIsEditing(false); }}
        >
          <X className="w-3 h-3" />
        </Button>
      </div>
    );
  }

  return (
    <span
      className={cn('cursor-pointer group/stage inline-flex items-center gap-1', className)}
      onClick={(e) => {
        e.stopPropagation();
        setIsEditing(true);
      }}
      title="Click to change stage"
    >
      {toChapterLabel(currentStage)}
      <Pencil className="w-3 h-3 opacity-0 group-hover/stage:opacity-50 transition-opacity" />
    </span>
  );
}

interface InlineNextStepEditProps {
  opportunityId: string;
  currentValue: string;
  className?: string;
}

export function InlineNextStepEdit({ opportunityId, currentValue, className }: InlineNextStepEditProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(currentValue);
  const updateOpportunity = useUpdateOpportunity();

  const handleSave = async () => {
    if (draft.trim() === currentValue) {
      setIsEditing(false);
      return;
    }
    await updateOpportunity.mutateAsync({ id: opportunityId, next_step: draft.trim() || undefined });
    setIsEditing(false);
  };

  if (isEditing) {
    return (
      <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSave();
            if (e.key === 'Escape') setIsEditing(false);
          }}
          className="h-7 text-xs"
          maxLength={500}
          autoFocus
        />
        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={handleSave}>
          <Check className="w-3 h-3" />
        </Button>
        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setIsEditing(false)}>
          <X className="w-3 h-3" />
        </Button>
      </div>
    );
  }

  return (
    <span
      className={cn('cursor-pointer group/next inline-flex items-center gap-1', className)}
      onClick={(e) => {
        e.stopPropagation();
        setDraft(currentValue);
        setIsEditing(true);
      }}
      title="Click to edit next step"
    >
      <span className="truncate">{currentValue || 'Add next step...'}</span>
      <Pencil className="w-3 h-3 opacity-0 group-hover/next:opacity-50 transition-opacity shrink-0" />
    </span>
  );
}
