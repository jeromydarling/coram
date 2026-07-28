import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/components/ui/sonner';
import type { Json } from '@/integrations/supabase/types';

export interface SegmentDefinition {
  partner_tiers?: string[];
  opportunity_ids?: string[];
  metro_ids?: string[];
  has_email_only?: boolean;
}

export interface EmailSegment {
  id: string;
  created_by: string;
  name: string;
  description: string | null;
  definition: SegmentDefinition;
  created_at: string;
  updated_at: string;
}

export function useEmailSegments() {
  return useQuery({
    queryKey: ['email-segments'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('email_segments')
        .select('*')
        .order('name', { ascending: true });
      if (error) throw error;
      return (data || []).map(d => ({ ...d, definition: d.definition as unknown as SegmentDefinition })) as EmailSegment[];
    }
  });
}

export function useCreateEmailSegment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (segment: { name: string; description?: string; definition: SegmentDefinition }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');
      const { data, error } = await supabase
        .from('email_segments')
        .insert({ ...segment, definition: segment.definition as unknown as Json, created_by: user.id })
        .select()
        .single();
      if (error) throw error;
      return { ...data, definition: data.definition as unknown as SegmentDefinition } as EmailSegment;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['email-segments'] }); toast.success('Segment saved'); },
    onError: (error) => { toast.error(`Failed to save segment: ${error.message}`); }
  });
}

export function useUpdateEmailSegment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, definition, ...updates }: Partial<EmailSegment> & { id: string }) => {
      const updateData: Record<string, unknown> = { ...updates, updated_at: new Date().toISOString() };
      if (definition) updateData.definition = definition as unknown as Json;
      const { data, error } = await supabase.from('email_segments').update(updateData).eq('id', id).select().single();
      if (error) throw error;
      return { ...data, definition: data.definition as unknown as SegmentDefinition } as EmailSegment;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['email-segments'] }); toast.success('Segment updated'); },
    onError: (error) => { toast.error(`Failed to update segment: ${error.message}`); }
  });
}

export function useDeleteEmailSegment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from('email_segments').delete().eq('id', id); if (error) throw error; },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['email-segments'] }); toast.success('Segment deleted'); },
    onError: (error) => { toast.error(`Failed to delete segment: ${error.message}`); }
  });
}
