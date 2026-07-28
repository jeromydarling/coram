import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { handleMutationError } from '@/lib/permissionErrors';

export interface Provision {
  id: string;
  opportunity_id: string;
  metro_id: string | null;
  requested_by: string;
  assigned_to: string | null;
  status: string;
  source: string;
  external_order_ref: string | null;
  notes: string | null;
  total_cents: number;
  total_quantity: number;
  tracking_carrier: string | null;
  tracking_number: string | null;
  delivery_status: string | null;
  requested_at: string;
  submitted_at: string | null;
  ordered_at: string | null;
  shipped_at: string | null;
  delivered_at: string | null;
  canceled_at: string | null;
  created_at: string;
  updated_at: string;
  // Invoice fields
  invoice_type?: string;
  invoice_date?: string | null;
  business_unit?: string | null;
  client_id?: string | null;
  business_name?: string | null;
  business_address?: string | null;
  business_city?: string | null;
  business_state?: string | null;
  business_zip?: string | null;
  contact_name?: string | null;
  contact_email?: string | null;
  payment_due_date?: string | null;
  paid?: boolean;
  date_paid?: string | null;
  exported_at?: string | null;
  export_count?: number;
}

export interface ProvisionFilters {
  status?: string;
  metro_id?: string;
  opportunity_id?: string;
  source?: string;
}

export function useProvisions(filters?: ProvisionFilters) {
  return useQuery({
    queryKey: ['provisions', filters],
    queryFn: async () => {
      let query = supabase
        .from('provisions' as any)
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200);

      if (filters?.status) query = query.eq('status', filters.status);
      if (filters?.metro_id) query = query.eq('metro_id', filters.metro_id);
      if (filters?.opportunity_id) query = query.eq('opportunity_id', filters.opportunity_id);
      if (filters?.source) query = query.eq('source', filters.source);

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as unknown as Provision[];
    },
  });
}

export function useProvisionDetail(provisionId: string | null) {
  return useQuery({
    queryKey: ['provision', provisionId],
    queryFn: async () => {
      if (!provisionId) return null;

      const [provResult, itemsResult, messagesResult] = await Promise.all([
        supabase.from('provisions' as any).select('*').eq('id', provisionId).single(),
        supabase.from('provision_items' as any).select('*').eq('provision_id', provisionId).order('created_at', { ascending: true }),
        supabase.from('provision_messages' as any).select('*').eq('provision_id', provisionId).order('created_at', { ascending: true }),
      ]);

      if (provResult.error) throw provResult.error;

      return {
        provision: provResult.data as unknown as Provision,
        items: (itemsResult.data || []) as any[],
        messages: (messagesResult.data || []) as any[],
      };
    },
    enabled: !!provisionId,
  });
}

export function useProvisionCatalog() {
  return useQuery({
    queryKey: ['provision-catalog'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('provision_catalog_items' as any)
        .select('*')
        .eq('active', true)
        .order('category')
        .order('tier')
        .order('name');

      if (error) throw error;
      return (data || []) as any[];
    },
  });
}

export function useProvisionMutations() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const createProvision = useMutation({
    mutationFn: async (payload: {
      opportunity_id: string;
      items: { catalog_item_id: string; quantity: number }[];
      notes?: string;
    }) => {
      const { data, error } = await supabase.functions.invoke('provision-create', {
        body: payload,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['provisions'] });
      toast({ title: 'Provision created', description: 'Your provision has been saved as a draft.' });
    },
    onError: (err: any) => {
      handleMutationError(err, () => toast({ title: 'Error', description: err.message || 'Failed to create provision', variant: 'destructive' }));
    },
  });

  const submitProvision = useMutation({
    mutationFn: async (provision_id: string) => {
      const { data, error } = await supabase.functions.invoke('provision-submit', {
        body: { provision_id },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['provisions'] });
      queryClient.invalidateQueries({ queryKey: ['provision'] });
      toast({ title: 'Provision submitted', description: 'Your provision has been submitted for review.' });
    },
    onError: (err: any) => {
      handleMutationError(err, () => toast({ title: 'Error', description: err.message || 'Failed to submit', variant: 'destructive' }));
    },
  });

  const updateProvision = useMutation({
    mutationFn: async (payload: { provision_id: string; [key: string]: any }) => {
      const { data, error } = await supabase.functions.invoke('provision-update', {
        body: payload,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['provisions'] });
      queryClient.invalidateQueries({ queryKey: ['provision'] });
      toast({ title: 'Provision updated' });
    },
    onError: (err: any) => {
      handleMutationError(err, () => toast({ title: 'Error', description: err.message || 'Failed to update', variant: 'destructive' }));
    },
  });

  const sendMessage = useMutation({
    mutationFn: async (payload: { provision_id: string; body: string }) => {
      const { data, error } = await supabase.functions.invoke('provision-message-create', {
        body: payload,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['provision'] });
      toast({ title: 'Message sent' });
    },
    onError: (err: any) => {
      handleMutationError(err, () => toast({ title: 'Error', description: err.message || 'Failed to send message', variant: 'destructive' }));
    },
  });

  const parseProvision = useMutation({
    mutationFn: async (payload: { raw_text: string; opportunity_id: string }) => {
      const { data, error } = await supabase.functions.invoke('provision-parse', {
        body: payload,
      });
      if (error) throw error;
      return data;
    },
    onError: (err: any) => {
      handleMutationError(err, () => toast({ title: 'Parse error', description: err.message || 'Failed to parse text', variant: 'destructive' }));
    },
  });

  return { createProvision, submitProvision, updateProvision, sendMessage, parseProvision };
}
