import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/contexts/TenantContext';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/components/ui/sonner';

export interface ActivityParticipant {
  id: string;
  tenant_id: string;
  activity_id: string;
  volunteer_id: string | null;
  contact_id: string | null;
  display_name: string;
  role: string;
  created_at: string;
}

export function useActivityParticipants(activityId: string | undefined) {
  return useQuery({
    queryKey: ['activity-participants', activityId],
    enabled: !!activityId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('activity_participants')
        .select('*')
        .eq('activity_id', activityId!)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data as ActivityParticipant[];
    },
  });
}

export function usePersonVisits(contactId: string | undefined) {
  return useQuery({
    queryKey: ['person-visits', contactId],
    enabled: !!contactId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('activities')
        .select(`
          id,
          activity_type,
          activity_date_time,
          notes,
          subject_contact_id,
          activity_participants (id, display_name, role, volunteer_id)
        `)
        .eq('subject_contact_id', contactId!)
        .in('activity_type', ['Visit Note', 'Meeting', 'Site Visit'])
        .order('activity_date_time', { ascending: false })
        .limit(20);
      if (error) throw error;
      return data;
    },
  });
}

export function useCreateParticipants() {
  const queryClient = useQueryClient();
  const { tenantId } = useTenant();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (participants: {
      activity_id: string;
      entries: Array<{
        volunteer_id?: string | null;
        contact_id?: string | null;
        display_name: string;
        role?: string;
      }>;
    }) => {
      if (!tenantId || !user?.id) throw new Error('Missing tenant or user');
      const rows = participants.entries.map(e => ({
        tenant_id: tenantId,
        activity_id: participants.activity_id,
        volunteer_id: e.volunteer_id || null,
        contact_id: e.contact_id || null,
        display_name: e.display_name,
        role: e.role || 'volunteer',
        created_by: user.id,
      }));
      const { error } = await supabase
        .from('activity_participants')
        .insert(rows);
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['activity-participants', vars.activity_id] });
      queryClient.invalidateQueries({ queryKey: ['person-visits'] });
    },
    onError: (error) => {
      toast.error(`Failed to add participants: ${error.message}`);
    },
  });
}
