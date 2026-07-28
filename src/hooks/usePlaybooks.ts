import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/components/ui/sonner';

export interface Playbook {
  id: string;
  title: string;
  description: string | null;
  content: string;
  category: 'metro' | 'anchor_type' | 'grant_type' | 'general';
  tags: string[];
  metro_id: string | null;
  anchor_tier: string | null;
  grant_type: string | null;
  created_by: string | null;
  updated_by: string | null;
  is_published: boolean;
  created_at: string;
  updated_at: string;
  // Joined fields
  metros?: { metro: string } | null;
}

export interface PlaybookInput {
  title: string;
  description?: string | null;
  content: string;
  category: 'metro' | 'anchor_type' | 'grant_type' | 'general';
  tags?: string[];
  metro_id?: string | null;
  anchor_tier?: string | null;
  grant_type?: string | null;
  is_published?: boolean;
}

export function usePlaybooks(filters?: {
  category?: string;
  metro_id?: string;
  anchor_tier?: string;
  grant_type?: string;
  search?: string;
}) {
  return useQuery({
    queryKey: ['playbooks', filters],
    queryFn: async () => {
      let query = supabase
        .from('playbooks')
        .select(`
          *,
          metros:metro_id(metro)
        `)
        .eq('is_published', true)
        .order('title', { ascending: true });

      if (filters?.category) {
        query = query.eq('category', filters.category);
      }
      if (filters?.metro_id) {
        query = query.eq('metro_id', filters.metro_id);
      }
      if (filters?.anchor_tier) {
        query = query.eq('anchor_tier', filters.anchor_tier);
      }
      if (filters?.grant_type) {
        query = query.eq('grant_type', filters.grant_type);
      }
      if (filters?.search) {
        query = query.or(`title.ilike.%${filters.search}%,description.ilike.%${filters.search}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as Playbook[];
    }
  });
}

export function usePlaybook(id: string | null) {
  return useQuery({
    queryKey: ['playbook', id],
    queryFn: async () => {
      if (!id) return null;

      const { data, error } = await supabase
        .from('playbooks')
        .select(`
          *,
          metros:metro_id(metro)
        `)
        .eq('id', id)
        .single();

      if (error) throw error;
      return data as Playbook;
    },
    enabled: !!id
  });
}

export function useCreatePlaybook() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: PlaybookInput) => {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { data, error } = await supabase
        .from('playbooks')
        .insert({
          ...input,
          created_by: user?.id,
          updated_by: user?.id
        } as never)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['playbooks'] });
      toast.success('Playbook created successfully');
    },
    onError: (error) => {
      toast.error(`Failed to create playbook: ${error.message}`);
    }
  });
}

export function useUpdatePlaybook() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...input }: Partial<PlaybookInput> & { id: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { data, error } = await supabase
        .from('playbooks')
        .update({
          ...input,
          updated_by: user?.id
        } as never)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['playbooks'] });
      queryClient.invalidateQueries({ queryKey: ['playbook'] });
      toast.success('Playbook updated successfully');
    },
    onError: (error) => {
      toast.error(`Failed to update playbook: ${error.message}`);
    }
  });
}

export function useDeletePlaybook() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('playbooks')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['playbooks'] });
      toast.success('Playbook deleted successfully');
    },
    onError: (error) => {
      toast.error(`Failed to delete playbook: ${error.message}`);
    }
  });
}
