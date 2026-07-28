/**
 * ManualGenerosityDialog — Log generosity received outside Stripe.
 *
 * WHAT: Records paper checks, cash gifts, in-kind donations as financial events.
 * WHERE: Settings → Payments, Financial Activity page.
 * WHY: Not all generosity flows through Stripe. Paper checks, cash, and in-kind gifts need
 *      the same relational presence in the timeline as digital payments.
 */
import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Heart } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/contexts/TenantContext';
import { crosToast } from '@/lib/crosToast';

const GENEROSITY_TYPES = [
  { value: 'check', label: 'Paper check' },
  { value: 'cash', label: 'Cash' },
  { value: 'in_kind', label: 'In-kind gift' },
  { value: 'wire', label: 'Wire / ACH transfer' },
  { value: 'other', label: 'Other' },
];

interface ManualGenerosityDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contactId?: string;
  contactName?: string;
}

export function ManualGenerosityDialog({ open, onOpenChange, contactId, contactName }: ManualGenerosityDialogProps) {
  const { tenantId } = useTenant();
  const qc = useQueryClient();

  const [donorName, setDonorName] = useState(contactName ?? '');
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('check');
  const [note, setNote] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [saved, setSaved] = useState(false);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const amountCents = Math.round(parseFloat(amount) * 100);
      if (isNaN(amountCents) || amountCents <= 0) throw new Error('Please enter a valid amount.');
      if (!donorName.trim()) throw new Error('Please enter the donor name.');

      const { error } = await supabase
        .from('financial_events' as any)
        .insert({
          tenant_id: tenantId,
          event_type: 'generosity',
          title: `${GENEROSITY_TYPES.find(t => t.value === method)?.label ?? method} from ${donorName.trim()}`,
          amount_cents: amountCents,
          status: 'completed',
          payer_name: donorName.trim(),
          contact_id: contactId || null,
          note: note || null,
          metadata: { method, recorded_date: date },
        });
      if (error) throw error;
    },
    onSuccess: () => {
      setSaved(true);
      qc.invalidateQueries({ queryKey: ['financial-events'] });
      crosToast.recorded('Generosity recorded.');
    },
    onError: (e) => crosToast.gentle(e.message),
  });

  const handleClose = () => {
    setDonorName(contactName ?? '');
    setAmount('');
    setMethod('check');
    setNote('');
    setDate(new Date().toISOString().split('T')[0]);
    setSaved(false);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Log Generosity</DialogTitle>
          <DialogDescription>
            Record a gift received outside of Stripe — paper checks, cash, in-kind contributions.
            This creates a note in the relationship timeline.
          </DialogDescription>
        </DialogHeader>

        {!saved ? (
          <div className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="gen-name">From</Label>
              <Input
                id="gen-name"
                value={donorName}
                onChange={(e) => setDonorName(e.target.value)}
                placeholder="Donor name"
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="gen-method">Method</Label>
              <Select value={method} onValueChange={setMethod}>
                <SelectTrigger id="gen-method"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {GENEROSITY_TYPES.map(t => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label htmlFor="gen-amount">Amount ($)</Label>
              <Input
                id="gen-amount"
                type="number"
                min="0.01"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="100.00"
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="gen-date">Date received</Label>
              <Input
                id="gen-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="gen-note">Note (optional)</Label>
              <Textarea
                id="gen-note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="A brief note about this gift…"
                rows={2}
              />
            </div>

            <Button
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending}
              className="w-full"
            >
              {saveMutation.isPending ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Recording…</>
              ) : (
                <><Heart className="mr-2 h-4 w-4" /> Record Generosity</>
              )}
            </Button>
          </div>
        ) : (
          <div className="text-center space-y-4 py-4">
            <Heart className="h-10 w-10 text-primary mx-auto" />
            <p className="text-sm text-muted-foreground">Your generosity has been recorded.</p>
            <Button variant="ghost" size="sm" onClick={handleClose}>Done</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
