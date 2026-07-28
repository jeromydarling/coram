import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useSaveEmailDraft } from '@/hooks/useMemoryThreads';
import { toast } from '@/components/ui/sonner';
import { Copy, Save, Mail } from 'lucide-react';

interface CheckInEmailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  opportunityId?: string;
  partnerName?: string;
  subject: string;
  body: string;
  reason: string;
  recipientEmails?: string[];
}

export function CheckInEmailModal({
  open,
  onOpenChange,
  opportunityId,
  partnerName,
  subject: initialSubject,
  body: initialBody,
  reason,
  recipientEmails = [],
}: CheckInEmailModalProps) {
  const [subject, setSubject] = useState(initialSubject);
  const [body, setBody] = useState(initialBody);
  const saveDraft = useSaveEmailDraft();

  const handleCopy = () => {
    navigator.clipboard.writeText(`Subject: ${subject}\n\n${body}`);
    toast.success('Copied to clipboard');
  };

  const handleSaveDraft = async () => {
    try {
      await saveDraft.mutateAsync({
        opportunity_id: opportunityId,
        subject,
        body,
        context: { reason, partner_name: partnerName },
      });
      toast.success('Draft saved');
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Mail className="w-4 h-4 text-primary" />
            Gentle check-in{partnerName ? ` — ${partnerName}` : ''}
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            {reason}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 mt-2">
          {recipientEmails.length > 0 && (
            <div>
              <label className="text-xs text-muted-foreground">Suggested recipients</label>
              <p className="text-sm">{recipientEmails.join(', ')}</p>
            </div>
          )}

          <div>
            <label className="text-xs text-muted-foreground">Subject</label>
            <Input
              value={subject}
              onChange={e => setSubject(e.target.value)}
              className="mt-1"
            />
          </div>

          <div>
            <label className="text-xs text-muted-foreground">Body</label>
            <Textarea
              value={body}
              onChange={e => setBody(e.target.value)}
              className="mt-1 min-h-[150px]"
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={handleCopy} className="gap-1.5">
              <Copy className="w-3.5 h-3.5" />
              Copy
            </Button>
            <Button
              size="sm"
              onClick={handleSaveDraft}
              disabled={saveDraft.isPending || !subject.trim() || !body.trim()}
              className="gap-1.5"
            >
              <Save className="w-3.5 h-3.5" />
              {saveDraft.isPending ? 'Saving…' : 'Save draft'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
