/**
 * CreateInvoiceDialog — Send an invoice to a person.
 *
 * WHAT: Dialog for creating a Stripe-hosted invoice linked to a contact.
 * WHERE: PersonDetail actions.
 * WHY: Enables collaboration payments as part of a relationship thread.
 */
import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, ExternalLink, Copy } from 'lucide-react';
import { useCreateInvoice } from '@/hooks/useStripeConnect';
import { crosToast } from '@/lib/crosToast';

interface CreateInvoiceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contactId?: string;
  contactName?: string;
  contactEmail?: string;
}

export function CreateInvoiceDialog({ open, onOpenChange, contactId, contactName, contactEmail }: CreateInvoiceDialogProps) {
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [note, setNote] = useState('');
  const [email, setEmail] = useState(contactEmail ?? '');
  const [result, setResult] = useState<{ hosted_url: string } | null>(null);

  const createInvoice = useCreateInvoice();

  const handleSubmit = () => {
    const amountCents = Math.round(parseFloat(amount) * 100);
    if (!description || isNaN(amountCents) || amountCents <= 0) {
      crosToast.gentle('Please provide a description and valid amount.');
      return;
    }

    createInvoice.mutate({
      contact_id: contactId,
      description,
      amount_cents: amountCents,
      due_date: dueDate || undefined,
      note: note || undefined,
      recipient_email: email || undefined,
    }, {
      onSuccess: (data) => {
        setResult({ hosted_url: data.hosted_url });
        crosToast.recorded('Invoice sent.');
      },
      onError: (e) => crosToast.gentle(e.message),
    });
  };

  const handleClose = () => {
    setDescription('');
    setAmount('');
    setDueDate('');
    setNote('');
    setEmail(contactEmail ?? '');
    setResult(null);
    onOpenChange(false);
  };

  const handleCopyLink = () => {
    if (result?.hosted_url) {
      navigator.clipboard.writeText(result.hosted_url);
      crosToast.noted('Link copied.');
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Send Invoice</DialogTitle>
          <DialogDescription>
            {contactName
              ? `Create an invoice for ${contactName}. They'll complete payment securely through Stripe.`
              : 'Create and send a payment invoice. Payment is handled securely through Stripe.'}
          </DialogDescription>
        </DialogHeader>

        {!result ? (
          <div className="space-y-4">
            <p className="text-xs text-muted-foreground italic">
              You'll complete this securely through Stripe. Funds go directly to your organization.
            </p>

            {!contactEmail && (
              <div className="space-y-1">
                <Label htmlFor="inv-email">Recipient email</Label>
                <Input id="inv-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@example.com" />
              </div>
            )}

            <div className="space-y-1">
              <Label htmlFor="inv-desc">Description</Label>
              <Input id="inv-desc" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Speaking honorarium" />
            </div>

            <div className="space-y-1">
              <Label htmlFor="inv-amount">Amount ($)</Label>
              <Input id="inv-amount" type="number" min="0.50" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="500.00" />
            </div>

            <div className="space-y-1">
              <Label htmlFor="inv-due">Due date (optional)</Label>
              <Input id="inv-due" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </div>

            <div className="space-y-1">
              <Label htmlFor="inv-note">Note (optional)</Label>
              <Textarea id="inv-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="A brief note about this invoice…" rows={2} />
            </div>

            <Button onClick={handleSubmit} disabled={createInvoice.isPending} className="w-full">
              {createInvoice.isPending ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Creating…</>
              ) : 'Send Invoice'}
            </Button>
          </div>
        ) : (
          <div className="space-y-4 text-center">
            <p className="text-sm text-muted-foreground">Held. The invoice has been sent.</p>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={handleCopyLink}>
                <Copy className="mr-2 h-4 w-4" /> Copy link
              </Button>
              <Button className="flex-1" onClick={() => window.open(result.hosted_url, '_blank')}>
                <ExternalLink className="mr-2 h-4 w-4" /> View invoice
              </Button>
            </div>
            <Button variant="ghost" size="sm" onClick={handleClose}>Done</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
