import { useState } from 'react';
import { format, parseISO } from 'date-fns';
import { Package, Plus, AlertTriangle, Trash2, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useOpportunityOrders } from '@/hooks/useOpportunityOrders';
import { LogOrderModal } from './LogOrderModal';
import { cn } from '@/lib/utils';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface OpportunityOrdersCardProps {
  opportunityId: string;
  opportunityStage?: string | null;
  onStageUpdateRequest?: () => void;
}

const PRE_FIRST_VOLUME_STAGES = [
  'Target Identified',
  'Contacted',
  'Discovery Scheduled',
  'Discovery Held',
  'Proposal Sent',
  'Agreement Pending',
  'Agreement Signed',
];

export function OpportunityOrdersCard({ 
  opportunityId, 
  opportunityStage,
  onStageUpdateRequest 
}: OpportunityOrdersCardProps) {
  const [showLogModal, setShowLogModal] = useState(false);
  const [orderToDelete, setOrderToDelete] = useState<string | null>(null);
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null);
  const { orders, signals, isLoading, logOrder, deleteOrder } = useOpportunityOrders(opportunityId);

  const hasOrders = orders.length > 0;
  const showStageBanner = hasOrders && opportunityStage && PRE_FIRST_VOLUME_STAGES.includes(opportunityStage);

  const handleLogOrder = async (orderDate: string, items: { catalog_item_id: string; quantity: number; unit_price_cents: number; product_name?: string }[], overrideTotalCents?: number) => {
    await logOrder.mutateAsync({ orderDate, items, overrideTotalCents });
    setShowLogModal(false);
  };

  const handleDeleteOrder = async () => {
    if (orderToDelete) {
      await deleteOrder.mutateAsync(orderToDelete);
      setOrderToDelete(null);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Package className="w-4 h-4 text-muted-foreground" />
          <p className="text-xs uppercase tracking-wide text-muted-foreground font-medium">
            What We've Provided
          </p>
        </div>
        <Button 
          size="sm" 
          variant="outline" 
          className="gap-1.5 h-7 text-xs"
          onClick={() => setShowLogModal(true)}
        >
          <Plus className="w-3 h-3" />
          Log Order
        </Button>
      </div>

      {/* Stage update banner */}
      {showStageBanner && (
        <div className="flex items-start gap-2 p-3 rounded-lg bg-warning/10 border border-warning/20">
          <AlertTriangle className="w-4 h-4 text-warning shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-sm text-warning font-medium">
              Order logged — consider moving this opportunity to First Volume.
            </p>
            {onStageUpdateRequest && (
              <Button 
                size="sm" 
                variant="link" 
                className="h-auto p-0 text-warning hover:text-warning/80"
                onClick={onStageUpdateRequest}
              >
                Update stage now →
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Orders list */}
      {isLoading ? (
        <div className="text-sm text-muted-foreground py-2">Loading orders...</div>
      ) : orders.length === 0 ? (
        <div className="text-sm text-muted-foreground py-2">
          No orders logged yet. Click "Log Order" to record a recent order.
        </div>
      ) : (
        <div className="space-y-2">
          {orders.map((order) => {
            const isExpanded = expandedOrder === order.id;
            const hasItems = order.items && order.items.length > 0;
            return (
              <div key={order.id} className="rounded bg-muted/30 group">
                <div className="flex items-center justify-between py-1.5 px-2">
                  <button
                    type="button"
                    className="flex items-center gap-2 text-left min-w-0"
                    onClick={() => hasItems && setExpandedOrder(isExpanded ? null : order.id)}
                  >
                    {hasItems && (
                      isExpanded
                        ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                        : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                    )}
                    <span className="text-sm text-foreground">
                      {format(parseISO(order.order_date), 'MMM d, yyyy')}
                    </span>
                  </button>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className={cn(
                      "text-xs",
                      order.total_quantity >= 10 && "bg-success/15 text-success"
                    )}>
                      {order.total_quantity} {order.total_quantity === 1 ? 'unit' : 'units'}
                    </Badge>
                    {order.total_cents > 0 && (
                      <span className="text-xs text-muted-foreground">
                        ${(order.total_cents / 100).toFixed(2)}
                      </span>
                    )}
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive hover:bg-destructive/10"
                      onClick={() => setOrderToDelete(order.id)}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
                {/* Expanded items */}
                {isExpanded && hasItems && (
                  <div className="px-3 pb-2 space-y-1 border-t border-border/50 pt-1.5">
                    {order.items!.map((item) => (
                      <div key={item.id} className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground min-w-0 break-words">
                          {item.catalog_item?.name || item.product_name || 'Unknown item'}
                          {item.catalog_item?.tier && (
                            <span className="text-muted-foreground/70"> · {item.catalog_item.tier}</span>
                          )}
                        </span>
                        <span className="text-foreground shrink-0 ml-2">
                          ×{item.quantity}
                          {item.unit_price_cents > 0 && (
                            <span className="text-muted-foreground ml-1">
                              (${(item.unit_price_cents * item.quantity / 100).toFixed(2)})
                            </span>
                          )}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Order signals summary */}
      {signals && (signals.orders_last_30 > 0 || signals.orders_last_90 > 0) && (
        <div className="flex gap-3 pt-2 border-t border-border text-xs text-muted-foreground">
          <span>
            <strong className="text-foreground">{signals.orders_last_30}</strong> last 30 days
          </span>
          <span>
            <strong className="text-foreground">{signals.orders_last_90}</strong> last 90 days
          </span>
        </div>
      )}

      <LogOrderModal
        open={showLogModal}
        onOpenChange={setShowLogModal}
        onSubmit={handleLogOrder}
        isSubmitting={logOrder.isPending}
      />

      <AlertDialog open={!!orderToDelete} onOpenChange={(open) => !open && setOrderToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Order</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this order? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteOrder}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteOrder.isPending ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
