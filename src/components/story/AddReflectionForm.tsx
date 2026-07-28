import { useState, useRef } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAddReflection } from '@/hooks/useReflections';
import { Feather, Loader2, Send, CalendarClock } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AddReflectionFormProps {
  opportunityId: string;
}

const CHAR_SOFT_LIMIT = 5500;
const CHAR_HARD_LIMIT = 6000;

export function AddReflectionForm({ opportunityId }: AddReflectionFormProps) {
  const [body, setBody] = useState('');
  const [visibility, setVisibility] = useState<'team' | 'private'>('team');
  const [followUpDate, setFollowUpDate] = useState('');
  const [showFollowUp, setShowFollowUp] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submittingRef = useRef(false);
  const addReflection = useAddReflection();

  const getFollowUpDate = (preset: string) => {
    const d = new Date();
    switch (preset) {
      case 'tomorrow': d.setDate(d.getDate() + 1); break;
      case '3days': d.setDate(d.getDate() + 3); break;
      case '1week': d.setDate(d.getDate() + 7); break;
      case '1month': d.setMonth(d.getMonth() + 1); break;
      default: return;
    }
    setFollowUpDate(d.toISOString().split('T')[0]);
  };

  const trimmed = body.trim();
  const charCount = trimmed.length;
  const overSoft = charCount > CHAR_SOFT_LIMIT;
  const overHard = charCount > CHAR_HARD_LIMIT;

  const handleSubmit = async () => {
    if (!trimmed || overHard || submittingRef.current) return;
    submittingRef.current = true;
    setError(null);
    try {
      await addReflection.mutateAsync({
        opportunityId,
        body: trimmed,
        visibility,
        followUpDate: followUpDate || undefined,
      });
      setBody('');
      setFollowUpDate('');
      setShowFollowUp(false);
      toast.success('Reflection saved');
    } catch (err: any) {
      setError(err?.message || 'Failed to add reflection. Please try again.');
    } finally {
      submittingRef.current = false;
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Feather className="w-4 h-4 text-primary" />
        <span className="text-sm font-medium">Add a reflection</span>
      </div>
      <Textarea
        value={body}
        onChange={e => setBody(e.target.value)}
        placeholder="What have you noticed, learned, or felt about this relationship?"
        className="min-h-[80px] text-sm"
        maxLength={CHAR_HARD_LIMIT + 100} // Allow a small buffer for UX, enforce on submit
      />
      {/* Follow-up section */}
      {showFollowUp ? (
        <div className="space-y-2 rounded-lg border border-border/50 p-3 bg-muted/20">
          <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
            <CalendarClock className="w-3.5 h-3.5" />
            Follow up with this person
          </div>
          <div className="flex flex-wrap gap-1.5">
            {[
              { label: 'Tomorrow', key: 'tomorrow' },
              { label: '3 days', key: '3days' },
              { label: '1 week', key: '1week' },
              { label: '1 month', key: '1month' },
            ].map(p => (
              <button
                key={p.key}
                type="button"
                onClick={() => getFollowUpDate(p.key)}
                className="px-2 py-1 text-[10px] rounded-md border border-border hover:border-primary/40 hover:bg-primary/5 transition-colors text-muted-foreground"
              >
                {p.label}
              </button>
            ))}
          </div>
          <Input
            type="date"
            value={followUpDate}
            onChange={e => setFollowUpDate(e.target.value)}
            className="h-7 text-xs w-auto"
          />
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setShowFollowUp(true)}
          className="text-[10px] text-muted-foreground hover:text-primary flex items-center gap-1 transition-colors"
        >
          <CalendarClock className="w-3 h-3" />
          Add follow-up reminder
        </button>
      )}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Select value={visibility} onValueChange={v => setVisibility(v as 'team' | 'private')}>
            <SelectTrigger className="w-32 h-7 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="team">Team visible</SelectItem>
              <SelectItem value="private">Private</SelectItem>
            </SelectContent>
          </Select>
          {charCount > 0 && (
            <span className={cn(
              'text-[10px]',
              overHard ? 'text-destructive font-medium' : overSoft ? 'text-warning' : 'text-muted-foreground/60',
            )}>
              {charCount.toLocaleString()}/{CHAR_HARD_LIMIT.toLocaleString()}
            </span>
          )}
        </div>
        <Button
          size="sm"
          className="gap-1.5 h-7 text-xs"
          disabled={!trimmed || overHard || addReflection.isPending}
          onClick={handleSubmit}
        >
          {addReflection.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
          Add reflection
        </Button>
      </div>
      {error && (
        <p className="text-xs text-destructive">{error}</p>
      )}
    </div>
  );
}
