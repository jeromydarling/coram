import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface HotspotProduct {
  id: string;
  name: string;
  category: string;
  product_type: string;
  network_type: string | null;
  active: boolean;
  display_order: number;
  created_at: string;
  updated_at: string;
}

export interface SubscriptionTerm {
  id: string;
  product_id: string;
  months: number;
  service_price_cents: number;
  bundle_price_cents: number | null;
  created_at: string;
}

export function useHotspotProducts(includeInactive = false) {
  return useQuery({
    queryKey: ['hotspot-products', includeInactive],
    queryFn: async () => {
      let query = supabase
        .from('pricing_products' as any)
        .select('*')
        .in('product_type', ['hotspot_device', 'hotspot_plan'])
        .order('display_order');

      if (!includeInactive) {
        query = query.eq('active', true);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as unknown as HotspotProduct[];
    },
  });
}

export function useSubscriptionTerms(productIds: string[]) {
  return useQuery({
    queryKey: ['subscription-terms', productIds],
    queryFn: async () => {
      if (productIds.length === 0) return [];
      const { data, error } = await supabase
        .from('pricing_subscription_terms' as any)
        .select('*')
        .in('product_id', productIds)
        .order('months');

      if (error) throw error;
      return (data || []) as unknown as SubscriptionTerm[];
    },
    enabled: productIds.length > 0,
  });
}

export function useHotspotPricingMutations() {
  const { toast } = useToast();
  const qc = useQueryClient();

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['hotspot-products'] });
    qc.invalidateQueries({ queryKey: ['subscription-terms'] });
  };

  const createProduct = useMutation({
    mutationFn: async (product: Omit<HotspotProduct, 'id' | 'created_at' | 'updated_at'>) => {
      const { data, error } = await supabase
        .from('pricing_products' as any)
        .insert(product as any)
        .select()
        .single();
      if (error) throw error;
      return data as unknown as HotspotProduct;
    },
    onSuccess: () => {
      invalidate();
      toast({ title: 'Product added' });
    },
    onError: (err: any) => {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    },
  });

  const updateProduct = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<HotspotProduct> & { id: string }) => {
      const { error } = await supabase
        .from('pricing_products' as any)
        .update(updates as any)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      toast({ title: 'Product updated' });
    },
    onError: (err: any) => {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    },
  });

  const upsertTerm = useMutation({
    mutationFn: async (term: { id?: string; product_id: string; months: number; service_price_cents: number; bundle_price_cents: number | null }) => {
      if (term.id) {
        const { error } = await supabase
          .from('pricing_subscription_terms' as any)
          .update({
            service_price_cents: term.service_price_cents,
            bundle_price_cents: term.bundle_price_cents,
          } as any)
          .eq('id', term.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('pricing_subscription_terms' as any)
          .insert({
            product_id: term.product_id,
            months: term.months,
            service_price_cents: term.service_price_cents,
            bundle_price_cents: term.bundle_price_cents,
          } as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      invalidate();
      toast({ title: 'Term saved' });
    },
    onError: (err: any) => {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    },
  });

  const deleteTerm = useMutation({
    mutationFn: async (termId: string) => {
      const { error } = await supabase
        .from('pricing_subscription_terms' as any)
        .delete()
        .eq('id', termId);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      toast({ title: 'Term deleted' });
    },
    onError: (err: any) => {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    },
  });

  return { createProduct, updateProduct, upsertTerm, deleteTerm };
}
