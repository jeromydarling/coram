import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface OpportunityOrderItem {
  id: string;
  order_id: string;
  catalog_item_id: string | null;
  quantity: number;
  unit_price_cents: number;
  product_name: string | null;
  created_at: string;
  // Joined
  catalog_item?: {
    name: string;
    category: string;
    tier: string | null;
  } | null;
}

export interface OpportunityOrder {
  id: string;
  opportunity_id: string;
  order_date: string;
  order_count: number;
  total_cents: number;
  total_quantity: number;
  notes: string | null;
  entered_by: string;
  created_at: string;
  items?: OpportunityOrderItem[];
}

export interface OpportunityOrderSignals {
  opportunity_id: string;
  last_order_date: string | null;
  orders_last_30: number;
  orders_last_90: number;
}

export function useOpportunityOrders(opportunityId: string | null) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch recent orders with items
  const { data: orders, isLoading } = useQuery({
    queryKey: ['opportunity-orders', opportunityId],
    queryFn: async () => {
      if (!opportunityId) return [];

      const { data, error } = await supabase
        .from('opportunity_orders')
        .select(`
          *,
          opportunity_order_items (
            id, catalog_item_id, quantity, unit_price_cents, product_name,
            provision_catalog_items ( name, category, tier )
          )
        `)
        .eq('opportunity_id', opportunityId)
        .order('order_date', { ascending: false })
        .limit(10);

      if (error) throw error;

      // Map nested items
      return (data || []).map((order: any) => ({
        ...order,
        items: (order.opportunity_order_items || []).map((item: any) => ({
          ...item,
          catalog_item: item.provision_catalog_items || null,
          product_name: item.product_name || null,
        })),
      })) as OpportunityOrder[];
    },
    enabled: !!opportunityId,
  });

  // Fetch order signals for scoring/pipeline
  const { data: signals } = useQuery({
    queryKey: ['opportunity-order-signals', opportunityId],
    queryFn: async () => {
      if (!opportunityId) return null;

      const { data, error } = await supabase
        .from('opportunity_order_signals')
        .select('*')
        .eq('opportunity_id', opportunityId)
        .maybeSingle();

      if (error) throw error;
      return data as OpportunityOrderSignals | null;
    },
    enabled: !!opportunityId,
  });

  // Log a new order with catalog items
  const logOrder = useMutation({
    mutationFn: async ({
      orderDate,
      items,
      overrideTotalCents,
    }: {
      orderDate: string;
      items: { catalog_item_id: string; quantity: number; unit_price_cents: number; product_name?: string }[];
      overrideTotalCents?: number;
    }) => {
      if (!opportunityId) throw new Error('No opportunity selected');

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const totalQuantity = items.reduce((s, i) => s + i.quantity, 0);
      const calculatedCents = items.reduce((s, i) => s + i.quantity * i.unit_price_cents, 0);
      const totalCents = overrideTotalCents !== undefined ? overrideTotalCents : calculatedCents;

      // Insert order
      const { data: order, error: orderError } = await supabase
        .from('opportunity_orders')
        .insert({
          opportunity_id: opportunityId,
          order_date: orderDate,
          order_count: totalQuantity,
          total_cents: totalCents,
          total_quantity: totalQuantity,
          entered_by: user.id,
        })
        .select()
        .single();

      if (orderError) throw orderError;

      // Insert order items (catalog_item_id nullable for hotspots)
      const orderItems = items.map((item) => ({
        order_id: order.id,
        catalog_item_id: item.catalog_item_id || null,
        quantity: item.quantity,
        unit_price_cents: item.unit_price_cents,
        product_name: item.product_name || null,
      }));

      const { error: itemsError } = await supabase
        .from('opportunity_order_items')
        .insert(orderItems);

      if (itemsError) throw itemsError;

      return order;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['opportunity-orders', opportunityId] });
      queryClient.invalidateQueries({ queryKey: ['opportunity-order-signals', opportunityId] });
      toast({
        title: 'Order logged',
        description: 'The order has been recorded successfully.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Error logging order',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Delete an order (admin/leadership only)
  const deleteOrder = useMutation({
    mutationFn: async (orderId: string) => {
      // Items cascade-delete with the order
      const { error } = await supabase
        .from('opportunity_orders')
        .delete()
        .eq('id', orderId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['opportunity-orders', opportunityId] });
      queryClient.invalidateQueries({ queryKey: ['opportunity-order-signals', opportunityId] });
      toast({
        title: 'Order deleted',
        description: 'The order has been removed.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Error deleting order',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  return {
    orders: orders ?? [],
    signals,
    isLoading,
    logOrder,
    deleteOrder,
  };
}

/**
 * Calculate order-based score contribution for pipeline scoring
 * - Within 30 days: +30 points
 * - 31-90 days: +15 points
 * - Momentum bonus: +MIN(orders_last_30, 10)
 */
export function calculateOrderScore(signals: OpportunityOrderSignals | null): number {
  if (!signals || !signals.last_order_date) return 0;

  const lastOrderDate = new Date(signals.last_order_date);
  const today = new Date();
  const daysSinceLastOrder = Math.floor((today.getTime() - lastOrderDate.getTime()) / (1000 * 60 * 60 * 24));

  let score = 0;

  if (daysSinceLastOrder <= 30) {
    score += 30;
  } else if (daysSinceLastOrder <= 90) {
    score += 15;
  }

  score += Math.min(signals.orders_last_30, 10);

  return score;
}
