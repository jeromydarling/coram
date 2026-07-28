import { useState, useEffect } from 'react';
import { useNoteHistory, useAddNote, useDeleteNote, EntityType } from '@/hooks/useNoteHistory';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { RichTextEditor, RichTextDisplay } from '@/components/ui/rich-text-editor';
import { Loader2, Send, Trash2, MessageSquare } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import DOMPurify from 'dompurify';
import { isDemoProxyActive } from '@/lib/demoWriteProxy';
import { toast } from 'sonner';

interface NoteHistoryPanelProps {
  entityType: EntityType;
  entityId: string | null;
  className?: string;
}

export function NoteHistoryPanel({ entityType, entityId, className }: NoteHistoryPanelProps) {
  const draftKey = entityId ? `cros_reflection_draft_${entityType}_${entityId}` : '';
  const [newNote, setNewNote] = useState(() => {
    if (typeof window === 'undefined' || !draftKey) return '';
    try { return sessionStorage.getItem(draftKey) || ''; } catch { return ''; }
  });

  // Persist draft on every change so a tab refresh never loses a reflection
  useEffect(() => {
    if (!draftKey) return;
    try {
      if (newNote && newNote.replace(/<[^>]*>/g, '').trim()) {
        sessionStorage.setItem(draftKey, newNote);
      } else {
        sessionStorage.removeItem(draftKey);
      }
    } catch { /* storage full — silently ignore */ }
  }, [newNote, draftKey]);

  const { data: notes, isLoading } = useNoteHistory(entityType, entityId);
  const addNote = useAddNote();
  const deleteNote = useDeleteNote();

  // Check if content is empty (accounts for empty HTML like <p></p>)
  const isNoteEmpty = (content: string) => {
    const stripped = content.replace(/<[^>]*>/g, '').trim();
    return stripped.length === 0;
  };

  const handleAddNote = async () => {
    if (!entityId || isNoteEmpty(newNote)) return;

    if (isDemoProxyActive()) {
      toast.info('Demo mode — reflections are not saved');
      setNewNote('');
      return;
    }
    
    await addNote.mutateAsync({
      entityType,
      entityId,
      content: newNote
    });
    
    setNewNote('');
    try { sessionStorage.removeItem(draftKey); } catch { /* noop */ }
  };

  const handleDeleteNote = async (noteId: string) => {
    if (!entityId) return;
    
    await deleteNote.mutateAsync({
      noteId,
      entityType,
      entityId
    });
  };

  if (!entityId) return null;

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      <div className="flex items-center gap-2 text-sm font-medium text-foreground">
        <MessageSquare className="w-4 h-4" />
        Reflections
      </div>

      {/* Add new note with WYSIWYG editor */}
      <div className="flex flex-col gap-2">
        <RichTextEditor
          content={newNote}
          onChange={setNewNote}
          placeholder="Add a reflection..."
          className="text-sm"
          editorClassName="min-h-[60px]"
        />
        <Button 
          size="sm"
          onClick={handleAddNote}
          disabled={isNoteEmpty(newNote) || addNote.isPending}
          className="self-end gap-2"
        >
          {addNote.isPending ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Send className="w-4 h-4" />
          )}
           Add Reflection
         </Button>
       </div>

      {/* Notes list */}
      <ScrollArea className="max-h-[200px]">
        {isLoading ? (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
          </div>
        ) : notes && notes.length > 0 ? (
          <div className="space-y-2 pr-3">
            {notes.map((note) => (
              <div 
                key={note.id} 
                className="group bg-muted/50 rounded-lg p-3 text-sm"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 max-h-32 overflow-y-auto">
                    <RichTextDisplay content={note.content} />
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                    onClick={() => handleDeleteNote(note.id)}
                    disabled={deleteNote.isPending}
                  >
                    <Trash2 className="w-3 h-3 text-muted-foreground hover:text-destructive" />
                  </Button>
                </div>
                <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                  <span>{note.author_name || 'Unknown user'}</span>
                  <span>•</span>
                  <span>{formatDistanceToNow(new Date(note.created_at), { addSuffix: true })}</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground text-center py-4">
            No reflections yet. Add one above.
          </p>
        )}
      </ScrollArea>
    </div>
  );
}
