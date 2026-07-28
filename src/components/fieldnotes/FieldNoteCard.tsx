/**
 * FieldNoteCard — Individual field note with optional expansion bridge.
 *
 * WHAT: Renders a single field note with "Convert to Expansion Plan" action.
 * WHERE: Field Notes page / list.
 * WHY: Human intention space — free-form planning that can seed structured expansion plans.
 */
import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Sprout, Trash2, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from '@/components/ui/sonner';
import { HelpTooltip } from '@/components/ui/help-tooltip';

export interface FieldNote {
  id: string;
  title: string;
  body: string;
  metro_id: string | null;
  metro_name?: string;
  tags: string[];
  created_at: string;
  updated_at: string;
}

interface FieldNoteCardProps {
  note: FieldNote;
  tenantId?: string;
  onDelete?: () => void;
}

export function FieldNoteCard({ note, tenantId, onDelete }: FieldNoteCardProps) {
  const [showConvertDialog, setShowConvertDialog] = useState(false);
  const queryClient = useQueryClient();

  const convertMutation = useMutation({
    mutationFn: async () => {
      if (!note.metro_id) throw new Error('Note must reference a metro');
      const row: Record<string, unknown> = {
        metro_id: note.metro_id,
        tenant_id: tenantId || null,
        status: 'research',
        priority: 0,
        notes: `Seeded from field note: "${note.title}"\n\n${note.body}`,
        source_note_id: note.id,
      };
      const { error } = await supabase
        .from('metro_expansion_plans')
        .insert([row as any]);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Expansion plan created from field note');
      queryClient.invalidateQueries({ queryKey: ['metro-expansion-plan'] });
      setShowConvertDialog(false);
    },
    onError: (err: any) => toast.error(err.message || 'Failed to create expansion plan'),
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('field_notes')
        .delete()
        .eq('id', note.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Field note removed');
      onDelete?.();
    },
    onError: (err: any) => toast.error(err.message || 'Failed to delete'),
  });

  return (
    <>
      <Card className="rounded-xl border-border/50 hover:border-primary/20 transition-colors">
        <CardContent className="pt-5 pb-4 space-y-3">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h4 className="font-serif font-medium text-foreground text-sm leading-snug truncate">
                {note.title}
              </h4>
              <p className="text-xs text-muted-foreground mt-0.5">
                {format(new Date(note.created_at), 'MMM d, yyyy')}
              </p>
            </div>
            {note.metro_name && (
              <Badge variant="secondary" className="text-[10px] shrink-0">
                {note.metro_name}
              </Badge>
            )}
          </div>

          {note.body && (
            <p className="text-sm text-muted-foreground font-serif leading-relaxed line-clamp-3">
              {note.body}
            </p>
          )}

          {note.tags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {note.tags.map(tag => (
                <Badge key={tag} variant="outline" className="text-[10px]">{tag}</Badge>
              ))}
            </div>
          )}

          <div className="flex items-center gap-2 pt-1">
            {note.metro_id && (
              <Button
                variant="ghost"
                size="sm"
                className="text-xs text-primary hover:text-primary/80"
                onClick={() => setShowConvertDialog(true)}
              >
                <Sprout className="h-3.5 w-3.5 mr-1" />
                Convert to Expansion Plan
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              className="text-xs text-muted-foreground hover:text-destructive ml-auto"
              disabled={deleteMutation.isPending}
              onClick={() => deleteMutation.mutate()}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={showConvertDialog} onOpenChange={setShowConvertDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-serif">Convert to Expansion Plan?</AlertDialogTitle>
            <AlertDialogDescription>
              This will create a new expansion plan for{' '}
              <strong>{note.metro_name || 'the referenced metro'}</strong> seeded with your field note content.
              The original note will remain unchanged.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => convertMutation.mutate()}
              disabled={convertMutation.isPending}
            >
              {convertMutation.isPending ? (
                <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> Creating…</>
              ) : (
                <><Sprout className="h-4 w-4 mr-1" /> Create Plan</>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
