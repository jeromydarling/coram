import { useState } from 'react';
import {
  usePartnerSuggestions,
  useDismissSuggestion,
  type PartnerSuggestion,
} from '@/hooks/usePartnerSuggestions';
import { useCreateJournalEntry } from '@/hooks/useMetroNarratives';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Heart,
  Mail,
  Pencil,
  X,
  Handshake,
  Gift,
  Users,
  Phone,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const typeConfig: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  check_in: { label: 'Check in', icon: <Phone className="w-3.5 h-3.5" />, color: 'text-primary' },
  offer_support: { label: 'Offer support', icon: <Handshake className="w-3.5 h-3.5" />, color: 'text-primary' },
  introduce_partner: { label: 'Introduce', icon: <Users className="w-3.5 h-3.5" />, color: 'text-primary' },
  share_resource: { label: 'Share resource', icon: <Gift className="w-3.5 h-3.5" />, color: 'text-primary' },
};

interface StorySuggestionsProps {
  narrativeId: string;
  metroId: string;
}

export function StorySuggestions({ narrativeId, metroId }: StorySuggestionsProps) {
  const { data: suggestions, isLoading } = usePartnerSuggestions(narrativeId);
  const [draftOpen, setDraftOpen] = useState(false);
  const [activeSuggestion, setActiveSuggestion] = useState<PartnerSuggestion | null>(null);
  const [noteOpen, setNoteOpen] = useState<string | null>(null);
  const [noteText, setNoteText] = useState('');

  if (isLoading || !suggestions || suggestions.length === 0) return null;

  return (
    <div className="space-y-3">
      <h4 className="text-sm font-medium text-foreground flex items-center gap-2">
        <Heart className="w-4 h-4 text-primary/70" />
        Connections you may want to nurture
      </h4>
      <p className="text-xs text-muted-foreground leading-relaxed">
        Based on what's happening in your community, these partners might appreciate hearing from you.
      </p>

      <div className="space-y-2">
        {suggestions.map((s) => (
          <SuggestionCard
            key={s.id}
            suggestion={s}
            metroId={metroId}
            narrativeId={narrativeId}
            onOpenDraft={() => { setActiveSuggestion(s); setDraftOpen(true); }}
            onOpenNote={() => { setNoteOpen(s.id); setNoteText(''); }}
            noteOpen={noteOpen === s.id}
            noteText={noteText}
            onNoteTextChange={setNoteText}
            onCloseNote={() => setNoteOpen(null)}
          />
        ))}
      </div>

      {/* Email draft dialog */}
      <Dialog open={draftOpen} onOpenChange={setDraftOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-base">
              Draft for {activeSuggestion?.organization}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">
              This is a suggested starting point — edit freely before sending from your email.
            </p>
            <pre className="text-sm whitespace-pre-wrap bg-muted/30 rounded-lg p-4 border border-border font-sans leading-relaxed">
              {activeSuggestion?.suggested_message_md ?? 'No draft available.'}
            </pre>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => setDraftOpen(false)}>
                Close
              </Button>
              <Button
                size="sm"
                onClick={() => {
                  if (activeSuggestion?.suggested_message_md) {
                    navigator.clipboard.writeText(activeSuggestion.suggested_message_md);
                  }
                }}
              >
                Copy to clipboard
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Individual suggestion card ──

function SuggestionCard({
  suggestion,
  metroId,
  narrativeId,
  onOpenDraft,
  onOpenNote,
  noteOpen,
  noteText,
  onNoteTextChange,
  onCloseNote,
}: {
  suggestion: PartnerSuggestion;
  metroId: string;
  narrativeId: string;
  onOpenDraft: () => void;
  onOpenNote: () => void;
  noteOpen: boolean;
  noteText: string;
  onNoteTextChange: (v: string) => void;
  onCloseNote: () => void;
}) {
  const dismiss = useDismissSuggestion();
  const createJournal = useCreateJournalEntry();
  const config = typeConfig[suggestion.suggestion_type] ?? typeConfig.check_in;

  const handleSaveNote = async () => {
    if (!noteText.trim()) return;
    await createJournal.mutateAsync({
      narrative_id: narrativeId,
      anchor_key: `suggestion::${suggestion.suggestion_type}`,
      note_text: noteText.trim(),
      metro_id: metroId,
    });
    onNoteTextChange('');
    onCloseNote();
  };

  return (
    <div className="rounded-lg border border-border bg-card p-3 space-y-2">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          <span className={cn('p-1 rounded-md bg-primary/5', config.color)}>
            {config.icon}
          </span>
          <div>
            <p className="text-sm font-medium text-foreground">{suggestion.organization}</p>
            <p className="text-xs text-muted-foreground">{config.label}</p>
          </div>
        </div>
        <button
          onClick={() => dismiss.mutate(suggestion.id)}
          className="text-muted-foreground/50 hover:text-muted-foreground transition-colors p-1"
          title="Dismiss"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Reasoning */}
      <p className="text-xs text-muted-foreground leading-relaxed italic">
        {suggestion.reasoning}
      </p>

      {/* Actions */}
      <div className="flex items-center gap-1.5 pt-1">
        <Button
          variant="outline"
          size="sm"
          className="h-7 text-xs gap-1.5"
          onClick={onOpenDraft}
        >
          <Mail className="w-3 h-3" />
          Open email draft
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-xs gap-1.5"
          onClick={onOpenNote}
        >
          <Pencil className="w-3 h-3" />
          Add note
        </Button>
      </div>

      {/* Inline note input */}
      {noteOpen && (
        <div className="bg-accent/30 border border-accent rounded-md p-2 space-y-1.5">
          <Textarea
            value={noteText}
            onChange={e => onNoteTextChange(e.target.value)}
            placeholder="Jot down a thought about this suggestion…"
            className="min-h-[40px] text-xs bg-transparent border-none shadow-none resize-none focus-visible:ring-0 p-0 italic"
            maxLength={2000}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSaveNote(); }
              if (e.key === 'Escape') onCloseNote();
            }}
          />
          <div className="flex justify-end gap-1">
            <Button variant="ghost" size="sm" className="h-5 px-1.5 text-[10px]" onClick={onCloseNote}>
              Cancel
            </Button>
            <Button
              size="sm"
              className="h-5 px-2 text-[10px]"
              disabled={!noteText.trim() || createJournal.isPending}
              onClick={handleSaveNote}
            >
              Save
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
