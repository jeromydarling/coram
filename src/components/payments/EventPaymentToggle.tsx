/**
 * EventPaymentToggle — Toggle paid event settings in event creation/edit.
 *
 * WHAT: Enables marking an event as paid with price and Stripe checkout.
 * WHERE: Event creation/edit dialog.
 * WHY: Enables participation payments for events while keeping the flow simple.
 */
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';

interface EventPaymentToggleProps {
  isPaid: boolean;
  onIsPaidChange: (val: boolean) => void;
  priceCents: number | null;
  onPriceCentsChange: (val: number | null) => void;
  disabled?: boolean;
}

export function EventPaymentToggle({
  isPaid, onIsPaidChange, priceCents, onPriceCentsChange, disabled,
}: EventPaymentToggleProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <Label>Paid Event</Label>
          <p className="text-xs text-muted-foreground">Enable if registration requires a payment.</p>
        </div>
        <Switch checked={isPaid} onCheckedChange={onIsPaidChange} disabled={disabled} />
      </div>

      {isPaid && (
        <div className="space-y-1 pl-1">
          <Label htmlFor="event-price">Price ($)</Label>
          <Input
            id="event-price"
            type="number"
            min="0.50"
            step="0.01"
            value={priceCents ? (priceCents / 100).toFixed(2) : ''}
            onChange={(e) => {
              const val = parseFloat(e.target.value);
              onPriceCentsChange(isNaN(val) ? null : Math.round(val * 100));
            }}
            placeholder="25.00"
            className="max-w-32"
          />
          <p className="text-xs text-muted-foreground italic">
            Payments are handled securely through Stripe. Funds go directly to your organization.
          </p>
        </div>
      )}
    </div>
  );
}
