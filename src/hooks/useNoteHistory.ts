import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/components/ui/sonner';

export type EntityType = 'event' | 'opportunity' | 'contact';

interface NoteHistory {
  id: string;
  entity_type: string;
  entity_id: string;
  content: string;
  created_by: string | null;
  created_at: string;
  author_name?: string | null;
}

export function useNoteHistory(entityType: EntityType, entityId: string | null) {
  return useQuery({
    queryKey: ['note_history', entityType, entityId],
    queryFn: async () => {
      if (!entityId) return [];
      
      // Fetch notes
      const { data: notes, error } = await supabase
        .from('note_history')
        .select('*')
        .eq('entity_type', entityType)
        .eq('entity_id', entityId)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      
      // Fetch author names for notes with created_by
      const userIds = [...new Set(notes?.filter(n => n.created_by).map(n => n.created_by) || [])];
      
      let profilesMap: Record<string, string> = {};
      if (userIds.length > 0) {
        // Use public view to avoid exposing sensitive tokens
        const { data: profiles } = await supabase
          .from('profiles_public')
          .select('user_id, display_name')
          .in('user_id', userIds);
        
        profilesMap = (profiles || []).reduce((acc, p) => {
          acc[p.user_id] = p.display_name || 'Unknown';
          return acc;
        }, {} as Record<string, string>);
      }
      
      // Combine notes with author names
      return (notes || []).map(note => ({
        ...note,
        author_name: note.created_by ? profilesMap[note.created_by] || 'Unknown' : null
      })) as NoteHistory[];
    },
    enabled: !!entityId
  });
}

export function useAddNote() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ 
      entityType, 
      entityId, 
      content 
    }: { 
      entityType: EntityType; 
      entityId: string; 
      content: string;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { data, error } = await supabase
        .from('note_history')
        .insert({
          entity_type: entityType,
          entity_id: entityId,
          content,
          created_by: user?.id
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ 
        queryKey: ['note_history', variables.entityType, variables.entityId] 
      });
      toast.success('Reflection added');
    },
    onError: (error) => {
      toast.error(`Failed to add reflection: ${error.message}`);
    }
  });
}

export function useDeleteNote() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ 
      noteId, 
      entityType, 
      entityId 
    }: { 
      noteId: string; 
      entityType: EntityType; 
      entityId: string;
    }) => {
      const { error } = await supabase
        .from('note_history')
        .delete()
        .eq('id', noteId);
      
      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ 
        queryKey: ['note_history', variables.entityType, variables.entityId] 
      });
      toast.success('Reflection deleted');
    },
    onError: (error) => {
      toast.error(`Failed to delete reflection: ${error.message}`);
    }
  });
}
