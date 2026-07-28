/**
 * useVolunteerTags — CRUD hooks for volunteer tag management.
 *
 * WHAT: Fetches, creates, and links/unlinks tags for volunteers.
 * WHERE: Used in Volunteers list and VolunteerDetail pages.
 * WHY: Lets tenants adapt workflows via lightweight tags (max 25).
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/contexts/TenantContext';
import { toast } from '@/components/ui/sonner';

export interface VolunteerTag {
  id: string;
  tenant_id: string;
  name: string;
  color: string;
  created_at: string;
}

const TAG_COLORS = [
  '#6b7280', '#ef4444', '#f97316', '#eab308',
  '#22c55e', '#06b6d4', '#3b82f6', '#8b5cf6',
  '#ec4899', '#78716c',
];

export { TAG_COLORS };

export function useVolunteerTags() {
  const { tenant } = useTenant();
  return useQuery({
    queryKey: ['volunteer-tags', tenant?.id],
    queryFn: async () => {
      if (!tenant?.id) return [];
      const { data, error } = await supabase
        .from('volunteer_tags')
        .select('*')
        .eq('tenant_id', tenant.id)
        .order('name');
      if (error) throw error;
      return (data || []) as VolunteerTag[];
    },
    enabled: !!tenant?.id,
  });
}

export function useVolunteerTagLinks(volunteerId?: string) {
  return useQuery({
    queryKey: ['volunteer-tag-links', volunteerId],
    queryFn: async () => {
      if (!volunteerId) return [];
      const { data, error } = await supabase
        .from('volunteer_tag_links')
        .select('tag_id')
        .eq('volunteer_id', volunteerId);
      if (error) throw error;
      return (data || []).map((r: { tag_id: string }) => r.tag_id) as string[];
    },
    enabled: !!volunteerId,
  });
}

export function useCreateVolunteerTag() {
  const qc = useQueryClient();
  const { tenant } = useTenant();
  return useMutation({
    mutationFn: async ({ name, color }: { name: string; color: string }) => {
      if (!tenant?.id) throw new Error('No tenant');
      const { data, error } = await supabase
        .from('volunteer_tags')
        .insert({ tenant_id: tenant.id, name: name.trim(), color })
        .select()
        .single();
      if (error) throw error;
      return data as VolunteerTag;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['volunteer-tags'] });
      toast.success('Tag created');
    },
    onError: (err: Error) => {
      if (err.message?.includes('duplicate')) {
        toast.error('A tag with that name already exists');
      } else {
        toast.error('Failed to create tag');
      }
    },
  });
}

export function useToggleVolunteerTag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ volunteerId, tagId, linked }: { volunteerId: string; tagId: string; linked: boolean }) => {
      if (linked) {
        const { error } = await supabase
          .from('volunteer_tag_links')
          .delete()
          .eq('volunteer_id', volunteerId)
          .eq('tag_id', tagId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('volunteer_tag_links')
          .insert({ volunteer_id: volunteerId, tag_id: tagId });
        if (error) throw error;
      }
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['volunteer-tag-links', vars.volunteerId] });
    },
  });
}

export function useDeleteVolunteerTag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (tagId: string) => {
      const { error } = await supabase
        .from('volunteer_tags')
        .delete()
        .eq('id', tagId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['volunteer-tags'] });
      qc.invalidateQueries({ queryKey: ['volunteer-tag-links'] });
      toast.success('Tag removed');
    },
  });
}
