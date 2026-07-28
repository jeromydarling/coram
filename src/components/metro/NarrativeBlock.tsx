import { useState, useRef, useMemo } from 'react';
import {
  useJournalEntries,
  useCreateJournalEntry,
  useDeleteJournalEntry,
  type JournalEntry,
} from '@/hooks/useMetroNarratives';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Pencil, X, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

interface NarrativeBlockProps {
  sectionKey: string;
  title: string;
  content: string;
  icon?: React.ReactNode;
  narrativeId: string;
  metroId: string;
  showNotes: boolean;
}

/** Split content into paragraphs for stable per-paragraph anchoring. */
function splitIntoParagraphs(content: string): string[] {
  return content
    .split(/\n\n+/)
    .map(p => p.trim())
    .filter(Boolean);
}

/** Build a stable anchor key for a paragraph within a section. */
function paragraphAnchorKey(sectionKey: string, index: number): string {
  return `${sectionKey}::p${index}`;
}

export function NarrativeBlock({
  sectionKey,
  title,
  content,
  icon,
  narrativeId,
  metroId,
  showNotes,
}: NarrativeBlockProps) {
  const { data: journalEntries } = useJournalEntries(narrativeId);

  const paragraphs = useMemo(() => splitIntoParagraphs(content), [content]);

  // Build a map of anchor_key → notes for quick lookup
  const notesByAnchor = useMemo(() => {
    const map = new Map<string, JournalEntry[]>();
    for (const je of journalEntries ?? []) {
      const key = je.anchor_key ?? '';
      // Match section-level keys (back-compat) and paragraph-level keys
      if (key === sectionKey || key.startsWith(`${sectionKey}::`)) {
        const existing = map.get(key) ?? [];
        existing.push(je);
        map.set(key, existing);
      }
    }
    return map;
  }, [journalEntries, sectionKey]);

  return (
    <div className="space-y-2 pl-4">
      <h4 className="text-sm font-medium text-foreground flex items-center gap-2">
        {icon}
        {title}
      </h4>

      {/* Section-level notes (back-compat) */}
      {showNotes && (notesByAnchor.get(sectionKey) ?? []).length > 0 && (
        <div className="space-y-1.5 ml-2">
          {(notesByAnchor.get(sectionKey) ?? []).map((note) => (
            <MarginNote key={note.id} note={note} narrativeId={narrativeId} metroId={metroId} />
          ))}
        </div>
      )}

      {/* Render each paragraph with its own margin scribble zone */}
      {paragraphs.map((paraText, idx) => (
        <ParagraphBlock
          key={`${sectionKey}::p${idx}`}
          text={paraText}
          anchorKey={paragraphAnchorKey(sectionKey, idx)}
          notes={notesByAnchor.get(paragraphAnchorKey(sectionKey, idx)) ?? []}
          narrativeId={narrativeId}
          metroId={metroId}
          showNotes={showNotes}
        />
      ))}
    </div>
  );
}

// ── Paragraph block with margin scribble ──

function ParagraphBlock({
  text,
  anchorKey,
  notes,
  narrativeId,
  metroId,
  showNotes,
}: {
  text: string;
  anchorKey: string;
  notes: JournalEntry[];
  narrativeId: string;
  metroId: string;
  showNotes: boolean;
}) {
  const createJournal = useCreateJournalEntry();
  const [isScribbling, setIsScribbling] = useState(false);
  const [scribbleText, setScribbleText] = useState('');
  const [isHovering, setIsHovering] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSaveScribble = async () => {
    if (!scribbleText.trim()) return;
    await createJournal.mutateAsync({
      narrative_id: narrativeId,
      anchor_key: anchorKey,
      note_text: scribbleText.trim(),
      metro_id: metroId,
    });
    setScribbleText('');
    // Keep scribble area open for rapid note-taking
    setTimeout(() => textareaRef.current?.focus(), 50);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSaveScribble();
    }
    if (e.key === 'Escape') {
      setIsScribbling(false);
      setScribbleText('');
    }
  };

  return (
    <div
      className="group/para relative"
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
    >
      {/* Margin pencil — hover on desktop, always visible with notes or on mobile via tap */}
      {showNotes && (
        <button
          onClick={() => {
            setIsScribbling(true);
            setTimeout(() => textareaRef.current?.focus(), 50);
          }}
          className={cn(
            'absolute -left-5 top-1 w-5 h-5 rounded-full flex items-center justify-center transition-all duration-200',
            'bg-primary/5 hover:bg-primary/15',
            // Show on hover OR when paragraph has notes OR on touch devices
            isHovering || notes.length > 0
              ? 'opacity-100'
              : 'opacity-0 md:group-hover/para:opacity-60',
            // Mobile: always show a subtle affordance via touch target
            'touch-manipulation',
          )}
          title="Add a margin note"
          aria-label="Add a margin note"
        >
          <Pencil className="w-2.5 h-2.5 text-primary/70" />
        </button>
      )}

      {/* Paragraph text */}
      <p className="text-sm text-muted-foreground leading-relaxed">
        {text}
      </p>

      {/* Margin notes for this paragraph — marginalia style */}
      {showNotes && notes.length > 0 && (
        <div className="mt-1 space-y-1 ml-1">
          {notes.map((note) => (
            <MarginNote key={note.id} note={note} narrativeId={narrativeId} metroId={metroId} />
          ))}
        </div>
      )}

      {/* Scribble input */}
      {isScribbling && (
        <div className="mt-1.5 bg-accent/30 border border-accent rounded-md p-2 space-y-1.5">
          <Textarea
            ref={textareaRef}
            value={scribbleText}
            onChange={e => setScribbleText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Scribble a margin note…"
            className="min-h-[48px] text-xs bg-transparent border-none shadow-none resize-none focus-visible:ring-0 p-0 italic"
            maxLength={2000}
          />
          <div className="flex items-center justify-between">
            <p className="text-[10px] text-muted-foreground">
              {scribbleText.length}/2000 · Enter save · Shift+Enter newline · Esc cancel
            </p>
            <div className="flex gap-1">
              <Button
                variant="ghost"
                size="sm"
                className="h-5 px-1.5 text-[10px]"
                onClick={() => { setIsScribbling(false); setScribbleText(''); }}
              >
                <X className="w-2.5 h-2.5" />
              </Button>
              <Button
                size="sm"
                className="h-5 px-2 text-[10px]"
                disabled={!scribbleText.trim() || createJournal.isPending}
                onClick={handleSaveScribble}
              >
                Save
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Margin note chip — marginalia style ──

function MarginNote({
  note,
  narrativeId: _narrativeId,
  metroId: _metroId,
}: {
  note: JournalEntry;
  narrativeId: string;
  metroId: string;
}) {
  const deleteJournal = useDeleteJournalEntry();
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      className={cn(
        'group/note flex items-start gap-1.5 px-2 py-1 rounded',
        'bg-accent/30 border-l-2 border-primary/20',
        'cursor-pointer transition-colors hover:bg-accent/50',
        'transform -rotate-[0.3deg]', // Subtle tilt for marginalia feel
      )}
      onClick={() => setExpanded(v => !v)}
    >
      <Pencil className="w-2.5 h-2.5 text-primary/40 mt-0.5 shrink-0" />
      <div className="flex-1 min-w-0">
        <p className={cn(
          'text-[11px] text-foreground/70 italic leading-snug',
          !expanded && 'line-clamp-1',
        )}>
          {note.note_text}
        </p>
        {expanded && (
          <p className="text-[9px] text-muted-foreground mt-0.5">
            {format(new Date(note.created_at), 'MMM d, h:mm a')}
          </p>
        )}
      </div>
      <button
        onClick={e => { e.stopPropagation(); deleteJournal.mutate(note.id); }}
        className="opacity-0 group-hover/note:opacity-100 transition-opacity shrink-0"
        title="Delete note"
      >
        <Trash2 className="w-2.5 h-2.5 text-destructive/50 hover:text-destructive" />
      </button>
    </div>
  );
}
