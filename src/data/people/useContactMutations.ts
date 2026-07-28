/**
 * useCreateContact / useUpdateContact / useDeleteContact — Person mutations.
 *
 * WHAT: Mutations on `public.contacts` with primary-contact bookkeeping on
 *       the parent opportunity, audit logging, and demo-mode safe paths.
 * WHERE: Used by Person modals, People list bulk edits, etc.
 * WHY: Centralizes invalidation so list, detail, and opportunity caches
 *      refresh consistently.
 *
 * Invalidation contract: `queryKeys.people.all(tenantId)` (prefix
 * `['contacts', tenantId]`) plus `['opportunities']` because primary-contact
 * changes mutate the related opportunity row.
 */
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/contexts/TenantContext';
import { queryKeys } from '@/lib/queryKeys';
import { crosToast } from '@/lib/crosToast';
import { isDemoProxyActive } from '@/lib/demoWriteProxy';
import { useLogAudit, computeChanges } from '@/hooks/useAuditLog';

export interface CreateContactInput {
  contact_id: string;
  opportunity_id?: string;
  name: string;
  title?: string;
  email?: string;
  phone?: string;
  is_primary?: boolean;
  notes?: string;
  met_at_event_id?: string;
  person_type?: string;
  is_person_in_need?: boolean;
}

export interface UpdateContactInput {
  id: string;
  _previousData?: Record<string, unknown>;
  name?: string;
  title?: string;
  email?: string;
  phone?: string;
  opportunity_id?: string | null;
  is_primary?: boolean;
  notes?: string;
  met_at_event_id?: string | null;
  person_type?: string;
  is_person_in_need?: boolean;
}

function useInvalidatePeople() {
  const queryClient = useQueryClient();
  const { tenantId } = useTenant();
  return () => {
    if (tenantId) {
      queryClient.invalidateQueries({ queryKey: queryKeys.people.all(tenantId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.opportunities.all(tenantId) });
    } else {
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      queryClient.invalidateQueries({ queryKey: ['opportunities'] });
    }
  };
}

export function useCreateContact() {
  const logAudit = useLogAudit();
  const invalidate = useInvalidatePeople();

  return useMutation({
    mutationFn: async (contact: CreateContactInput) => {
      if (contact.is_primary && contact.opportunity_id) {
        await supabase
          .from('contacts')
          .update({ is_primary: false })
          .eq('opportunity_id', contact.opportunity_id)
          .eq('is_primary', true);
      }

      const { data, error } = await supabase
        .from('contacts')
        .insert(contact)
        .select()
        .single();

      if (error) throw error;

      if (contact.is_primary && contact.opportunity_id) {
        await supabase
          .from('opportunities')
          .update({ primary_contact_id: data.id })
          .eq('id', contact.opportunity_id);
      }

      return data;
    },
    onSuccess: (data) => {
      invalidate();
      crosToast.noted('Person added');

      if (!data?.id || isDemoProxyActive()) return;
      logAudit.mutate({
        action: 'create',
        entityType: 'contact',
        entityId: data.id,
        entityName: data.name,
      });
    },
    onError: (error) => {
      crosToast.gentle(`Something didn't go through: ${error.message}`);
    },
  });
}

export function useUpdateContact() {
  const logAudit = useLogAudit();
  const invalidate = useInvalidatePeople();

  return useMutation({
    mutationFn: async ({ id, _previousData, ...contact }: UpdateContactInput) => {
      const oppId = contact.opportunity_id ?? (_previousData?.opportunity_id as string | null);
      if (contact.is_primary && oppId) {
        await supabase
          .from('contacts')
          .update({ is_primary: false })
          .eq('opportunity_id', oppId)
          .eq('is_primary', true)
          .neq('id', id);

        await supabase
          .from('opportunities')
          .update({ primary_contact_id: id })
          .eq('id', oppId);
      }

      const { data, error } = await supabase
        .from('contacts')
        .update(contact)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return { data, previousData: _previousData };
    },
    onSuccess: ({ data, previousData }) => {
      invalidate();
      crosToast.updated();

      if (!data?.id || isDemoProxyActive()) return;
      const changes = previousData
        ? computeChanges(previousData, data as Record<string, unknown>)
        : null;

      logAudit.mutate({
        action: 'update',
        entityType: 'contact',
        entityId: data.id,
        entityName: data.name,
        changes: changes || undefined,
      });
    },
    onError: (error) => {
      crosToast.gentle(`Something didn't go through: ${error.message}`);
    },
  });
}

export function useDeleteContact() {
  const logAudit = useLogAudit();
  const invalidate = useInvalidatePeople();

  return useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      if (isDemoProxyActive()) {
        return { id, name, __demo: true as const };
      }

      const { data: contact } = await supabase
        .from('contacts')
        .select('opportunity_id, is_primary')
        .eq('id', id)
        .single();

      const { error } = await supabase.from('contacts').delete().eq('id', id);
      if (error) throw error;

      if (contact?.is_primary && contact?.opportunity_id) {
        const { data: nextPrimary } = await supabase
          .from('contacts')
          .select('id')
          .eq('opportunity_id', contact.opportunity_id)
          .order('created_at', { ascending: true })
          .limit(1)
          .maybeSingle();

        if (nextPrimary) {
          await supabase.from('contacts').update({ is_primary: true }).eq('id', nextPrimary.id);
          await supabase
            .from('opportunities')
            .update({ primary_contact_id: nextPrimary.id })
            .eq('id', contact.opportunity_id);
        } else {
          await supabase
            .from('opportunities')
            .update({ primary_contact_id: null })
            .eq('id', contact.opportunity_id);
        }
      }

      return { id, name };
    },
    onSuccess: (result) => {
      if ('__demo' in result && result.__demo) return;
      invalidate();
      crosToast.removed();

      logAudit.mutate({
        action: 'delete',
        entityType: 'contact',
        entityId: result.id,
        entityName: result.name,
      });
    },
    onError: (error) => {
      crosToast.gentle(`Something didn't go through: ${error.message}`);
    },
  });
}
