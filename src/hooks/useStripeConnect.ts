/**
 * useStripeConnect — Hooks for Stripe Connect onboarding and status.
 *
 * WHAT: Manages Connect account creation, status polling, and payments configuration.
 * WHERE: Settings → Payments tab.
 * WHY: Tenants need self-service Stripe Connect onboarding to receive payments.
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/contexts/TenantContext';

interface ConnectStatus {
  connected: boolean;
  charges_enabled?: boolean;
  payouts_enabled?: boolean;
  details_submitted?: boolean;
  onboarding_completed_at?: string | null;
}

export function useStripeConnectStatus() {
  const { tenantId } = useTenant();

  return useQuery<ConnectStatus>({
    queryKey: ['stripe-connect-status', tenantId],
    enabled: !!tenantId,
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('stripe-connect-status', {
        body: { tenant_id: tenantId },
      });
      if (error) throw error;
      return data as ConnectStatus;
    },
    staleTime: 30_000,
  });
}

export function useStripeConnectOnboard() {
  const { tenantId } = useTenant();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const origin = window.location.origin;
      const { data, error } = await supabase.functions.invoke('stripe-connect-onboard', {
        body: {
          tenant_id: tenantId,
          refresh_url: `${origin}/${(window as any).__tenantSlug ?? ''}/settings?tab=payments&connect=refresh`,
          return_url: `${origin}/${(window as any).__tenantSlug ?? ''}/settings?tab=payments&connect=complete`,
        },
      });
      if (error) throw error;
      if (!data?.ok) throw new Error(data?.message || 'Failed to start onboarding');
      return data as { ok: boolean; url: string; account_id: string };
    },
    onSuccess: (data) => {
      // Open Stripe Connect onboarding in a new tab
      window.open(data.url, '_blank');
      // Refetch status after a delay
      setTimeout(() => qc.invalidateQueries({ queryKey: ['stripe-connect-status'] }), 5000);
    },
  });
}

export function useCreateInvoice() {
  const { tenantId } = useTenant();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      contact_id?: string;
      description: string;
      amount_cents: number;
      due_date?: string;
      note?: string;
      recipient_email?: string;
    }) => {
      const { data, error } = await supabase.functions.invoke('stripe-connect-create-invoice', {
        body: { tenant_id: tenantId, ...params },
      });
      if (error) throw error;
      if (!data?.ok) throw new Error(data?.message || 'Failed to create invoice');
      return data as { ok: boolean; invoice_id: string; hosted_url: string };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['financial-events'] });
      qc.invalidateQueries({ queryKey: ['tenant-invoices'] });
    },
  });
}

export function useCreatePaymentLink() {
  const { tenantId } = useTenant();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      title: string;
      amount_cents: number;
      event_type?: string;
      note?: string;
      contact_id?: string;
      event_id?: string;
      max_quantity?: number;
    }) => {
      const { data, error } = await supabase.functions.invoke('stripe-connect-create-payment-link', {
        body: { tenant_id: tenantId, ...params },
      });
      if (error) throw error;
      if (!data?.ok) throw new Error(data?.message || 'Failed to create payment link');
      return data as { ok: boolean; url: string; payment_link_id: string };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['financial-events'] });
      qc.invalidateQueries({ queryKey: ['tenant-payment-links'] });
    },
  });
}

export function useFinancialEvents(filters?: { event_type?: string }) {
  const { tenantId } = useTenant();

  return useQuery({
    queryKey: ['financial-events', tenantId, filters],
    enabled: !!tenantId,
    queryFn: async () => {
      let query = supabase
        .from('financial_events' as any)
        .select('*')
        .eq('tenant_id', tenantId!)
        .order('created_at', { ascending: false })
        .limit(200);

      if (filters?.event_type) {
        query = query.eq('event_type', filters.event_type);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as any[];
    },
  });
}

export function useTenantPaymentLinks() {
  const { tenantId } = useTenant();

  return useQuery({
    queryKey: ['tenant-payment-links', tenantId],
    enabled: !!tenantId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tenant_payment_links' as any)
        .select('*')
        .eq('tenant_id', tenantId!)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });
}

export function useTenantInvoices() {
  const { tenantId } = useTenant();

  return useQuery({
    queryKey: ['tenant-invoices', tenantId],
    enabled: !!tenantId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tenant_invoices' as any)
        .select('*')
        .eq('tenant_id', tenantId!)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });
}
