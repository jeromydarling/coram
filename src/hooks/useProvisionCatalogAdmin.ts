import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface CatalogItem {
  id: string;
  category: string;
  tier: string | null;
  name: string;
  description: string | null;
  unit_price_cents: number;
  default_gl_account: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export type CatalogItemInsert = Omit<CatalogItem, 'id' | 'created_at' | 'updated_at'>;
export type CatalogItemUpdate = Partial<CatalogItemInsert>;

export function useProvisionCatalogAdmin(showInactive: boolean) {
  return useQuery({
    queryKey: ['provision-catalog-admin', showInactive],
    queryFn: async () => {
      let query = supabase
        .from('provision_catalog_items' as any)
        .select('*')
        .order('category')
        .order('tier')
        .order('name');

      if (!showInactive) {
        query = query.eq('active', true);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as unknown as CatalogItem[];
    },
  });
}

export function useCatalogMutations() {
  const { toast } = useToast();
  const qc = useQueryClient();

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['provision-catalog-admin'] });
    qc.invalidateQueries({ queryKey: ['provision-catalog'] });
  };

  const createItem = useMutation({
    mutationFn: async (item: CatalogItemInsert) => {
      const { data, error } = await supabase
        .from('provision_catalog_items' as any)
        .insert(item as any)
        .select()
        .single();
      if (error) throw error;
      return data as unknown as CatalogItem;
    },
    onSuccess: () => {
      invalidate();
      toast({ title: 'Item added', description: 'Catalog item created successfully.' });
    },
    onError: (err: any) => {
      toast({ title: 'Error', description: err.message || 'Failed to create item', variant: 'destructive' });
    },
  });

  const updateItem = useMutation({
    mutationFn: async ({ id, ...updates }: CatalogItemUpdate & { id: string }) => {
      const { data, error } = await supabase
        .from('provision_catalog_items' as any)
        .update(updates as any)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data as unknown as CatalogItem;
    },
    onSuccess: () => {
      invalidate();
      toast({ title: 'Saved', description: 'Catalog item updated.' });
    },
    onError: (err: any) => {
      toast({ title: 'Error', description: err.message || 'Failed to update item', variant: 'destructive' });
    },
  });

  const toggleActive = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { error } = await supabase
        .from('provision_catalog_items' as any)
        .update({ active } as any)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      invalidate();
      toast({ title: vars.active ? 'Activated' : 'Deactivated' });
    },
    onError: (err: any) => {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    },
  });

  return { createItem, updateItem, toggleActive };
}
