/**
 * CreatePaymentLinkDialog — Create a shareable payment link.
 *
 * WHAT: Dialog for creating Stripe payment links for generosity, participation, support.
 * WHERE: Financial Activity page and event creation.
 * WHY: Simple, shareable links for receiving payments tied to relational moments.
 */
import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Copy, ExternalLink } from 'lucide-react';
import { useCreatePaymentLink } from '@/hooks/useStripeConnect';
import { crosToast } from '@/lib/crosToast';

const EVENT_TYPES = [
  { value: 'generosity', label: 'Generosity' },
  { value: 'participation', label: 'Participation' },
  { value: 'support', label: 'Support' },
  { value: 'collaboration', label: 'Collaboration' },
  { value: 'membership', label: 'Membership' },
];

interface CreatePaymentLinkDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contactId?: string;
  eventId?: string;
  defaultType?: string;
  defaultTitle?: string;
  defaultAmount?: number;
}

export function CreatePaymentLinkDialog({
  open, onOpenChange, contactId, eventId,
  defaultType, defaultTitle, defaultAmount,
}: CreatePaymentLinkDialogProps) {
  const [title, setTitle] = useState(defaultTitle ?? '');
  const [amount, setAmount] = useState(defaultAmount ? String(defaultAmount / 100) : '');
  const [eventType, setEventType] = useState(defaultType ?? 'support');
  const [note, setNote] = useState('');
  const [result, setResult] = useState<{ url: string } | null>(null);

  const createLink = useCreatePaymentLink();

  const handleSubmit = () => {
    const amountCents = Math.round(parseFloat(amount) * 100);
    if (!title || isNaN(amountCents) || amountCents <= 0) {
      crosToast.gentle('Please provide a title and valid amount.');
      return;
    }

    createLink.mutate({
      title,
      amount_cents: amountCents,
      event_type: eventType,
      note: note || undefined,
      contact_id: contactId,
      event_id: eventId,
    }, {
      onSuccess: (data) => {
        setResult({ url: data.url });
        crosToast.recorded('Payment link created.');
      },
      onError: (e) => crosToast.gentle(e.message),
    });
  };

  const handleClose = () => {
    setTitle(defaultTitle ?? '');
    setAmount(defaultAmount ? String(defaultAmount / 100) : '');
    setEventType(defaultType ?? 'support');
    setNote('');
    setResult(null);
    onOpenChange(false);
  };

  const handleCopy = () => {
    if (result?.url) {
      navigator.clipboard.writeText(result.url);
      crosToast.noted('Link copied.');
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create Payment Link</DialogTitle>
          <DialogDescription>
            Create a shareable link for receiving payments. Funds go directly to your organization through Stripe.
          </DialogDescription>
        </DialogHeader>

        {!result ? (
          <div className="space-y-4">
            <p className="text-xs text-muted-foreground italic">
              You'll complete this securely through Stripe. Funds go directly to your organization.
            </p>

            <div className="space-y-1">
              <Label htmlFor="pl-title">Title</Label>
              <Input id="pl-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Workshop registration" />
            </div>

            <div className="space-y-1">
              <Label htmlFor="pl-type">Type</Label>
              <Select value={eventType} onValueChange={setEventType}>
                <SelectTrigger id="pl-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EVENT_TYPES.map(t => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label htmlFor="pl-amount">Amount ($)</Label>
              <Input id="pl-amount" type="number" min="0.50" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="25.00" />
            </div>

            <div className="space-y-1">
              <Label htmlFor="pl-note">Note (optional)</Label>
              <Textarea id="pl-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="A brief note…" rows={2} />
            </div>

            <Button onClick={handleSubmit} disabled={createLink.isPending} className="w-full">
              {createLink.isPending ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Creating…</>
              ) : 'Create Payment Link'}
            </Button>
          </div>
        ) : (
          <div className="space-y-4 text-center">
            <p className="text-sm text-muted-foreground">Held. Your payment link is ready to share.</p>
            <div className="rounded-md bg-muted p-3">
              <p className="text-xs font-mono break-all">{result.url}</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={handleCopy}>
                <Copy className="mr-2 h-4 w-4" /> Copy link
              </Button>
              <Button className="flex-1" onClick={() => window.open(result.url, '_blank')}>
                <ExternalLink className="mr-2 h-4 w-4" /> Open
              </Button>
            </div>
            <Button variant="ghost" size="sm" onClick={handleClose}>Done</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
