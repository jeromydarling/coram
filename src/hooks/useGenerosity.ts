/**
 * useGenerosity — Hooks for generosity records on a Person.
 *
 * WHAT: CRUD for generosity_records, toggle for has_given_financially.
 * WHERE: PersonDetail generosity section.
 * WHY: Relational memory of financial generosity — not donor management.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/contexts/TenantContext';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/components/ui/sonner';

export interface GenerosityRecord {
  id: string;
  contact_id: string;
  tenant_id: string;
  gift_date: string;
  amount: number;
  is_recurring: boolean;
  recurring_frequency: string | null;
  note: string | null;
  created_at: string;
}

export function useGenerosityRecords(contactId: string | undefined) {
  const { tenantId } = useTenant();

  return useQuery({
    queryKey: ['generosity-records', contactId],
    enabled: !!contactId && !!tenantId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('generosity_records')
        .select('*')
        .eq('contact_id', contactId!)
        .eq('tenant_id', tenantId!)
        .order('gift_date', { ascending: false });
      if (error) throw error;
      return data as GenerosityRecord[];
    },
  });
}

export function useCreateGenerosityRecord() {
  const qc = useQueryClient();
  const { tenantId } = useTenant();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (record: {
      contact_id: string;
      gift_date: string;
      amount: number;
      is_recurring?: boolean;
      recurring_frequency?: string | null;
      note?: string;
    }) => {
      const { data, error } = await supabase
        .from('generosity_records')
        .insert({
          ...record,
          tenant_id: tenantId!,
          created_by: user?.id,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['generosity-records', vars.contact_id] });
      toast.success('Generosity record saved');
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeleteGenerosityRecord() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, contactId }: { id: string; contactId: string }) => {
      const { error } = await supabase.from('generosity_records').delete().eq('id', id);
      if (error) throw error;
      return { contactId };
    },
    onSuccess: (d) => {
      qc.invalidateQueries({ queryKey: ['generosity-records', d.contactId] });
      toast.success('Record removed');
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useToggleGenerosity() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ contactId, value }: { contactId: string; value: boolean }) => {
      const { error } = await supabase
        .from('contacts')
        .update({ has_given_financially: value } as any)
        .eq('id', contactId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['contacts'] });
    },
  });
}

/**
 * useGenerositySummary — Board report query for "Those Who Gave".
 */
export function useGenerositySummary(startDate: string, endDate: string) {
  const { tenantId } = useTenant();

  return useQuery({
    queryKey: ['generosity-summary', tenantId, startDate, endDate],
    enabled: !!tenantId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('generosity_records')
        .select('id, contact_id, gift_date, amount, is_recurring, recurring_frequency, contacts!inner(name)')
        .eq('tenant_id', tenantId!)
        .gte('gift_date', startDate)
        .lte('gift_date', endDate)
        .order('gift_date', { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });
}
