import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/contexts/TenantContext';
import { toast } from '@/components/ui/sonner';
import { queryKeys } from '@/lib/queryKeys';
import { supabaseRows } from '@/lib/supabaseRow';

export interface HouseholdMember {
  id: string;
  tenant_id: string;
  contact_id: string;
  name: string;
  relationship: string | null;
  notes: string | null;
  linked_contact_id: string | null;
  created_at: string;
}

export function useHouseholdMembers(contactId: string | undefined) {
  const { tenantId } = useTenant();

  return useQuery({
    queryKey: queryKeys.people.householdMembers(tenantId ?? '', contactId ?? ''),
    queryFn: async () => {
      if (!contactId || !tenantId) return [] as HouseholdMember[];
      const { data, error } = await supabase
        .from('contact_household_members')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('contact_id', contactId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return supabaseRows<HouseholdMember>(data);
    },
    enabled: !!contactId && !!tenantId,
  });
}

export function useCreateHouseholdMember() {
  const queryClient = useQueryClient();
  const { tenantId } = useTenant();

  return useMutation({
    mutationFn: async (member: {
      contact_id: string;
      name: string;
      relationship?: string | null;
      notes?: string | null;
      linked_contact_id?: string | null;
    }) => {
      if (!tenantId) throw new Error('No tenant');
      const { data, error } = await supabase
        .from('contact_household_members')
        .insert({ ...member, tenant_id: tenantId })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.people.householdMembers(tenantId ?? '', data.contact_id),
      });
      toast.success('Household member added');
    },
    onError: (error) => {
      toast.error(`Failed to add household member: ${error.message}`);
    },
  });
}

export function useUpdateHouseholdMember() {
  const queryClient = useQueryClient();
  const { tenantId } = useTenant();

  return useMutation({
    mutationFn: async ({ id, contactId, ...updates }: {
      id: string;
      contactId: string;
      name?: string;
      relationship?: string | null;
      notes?: string | null;
      linked_contact_id?: string | null;
    }) => {
      const { data, error } = await supabase
        .from('contact_household_members')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return { data, contactId };
    },
    onSuccess: ({ contactId }) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.people.householdMembers(tenantId ?? '', contactId),
      });
      toast.success('Household member updated');
    },
    onError: (error) => {
      toast.error(`Failed to update: ${error.message}`);
    },
  });
}

export function useDeleteHouseholdMember() {
  const queryClient = useQueryClient();
  const { tenantId } = useTenant();

  return useMutation({
    mutationFn: async ({ id, contactId }: { id: string; contactId: string }) => {
      const { error } = await supabase
        .from('contact_household_members')
        .delete()
        .eq('id', id);
      if (error) throw error;
      return { contactId };
    },
    onSuccess: ({ contactId }) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.people.householdMembers(tenantId ?? '', contactId),
      });
      toast.success('Household member removed');
    },
    onError: (error) => {
      toast.error(`Failed to remove: ${error.message}`);
    },
  });
}
