/**
 * ReportProfileButton — Public profile abuse reporting.
 *
 * WHAT: A small button on public presence pages to report inappropriate content.
 * WHERE: Rendered on /p/:tenantSlug public pages.
 * WHY: Required safeguard for user-generated public content.
 */

import { useState } from 'react';
import { Flag } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/components/ui/sonner';
import { supabase } from '@/integrations/supabase/client';

interface ReportProfileButtonProps {
  profileId: string;
  tenantId: string;
}

export function ReportProfileButton({ profileId, tenantId }: ReportProfileButtonProps) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!reason.trim()) {
      toast.error('Please describe the issue.');
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await supabase.from('content_reports').insert({
        profile_id: profileId,
        tenant_id: tenantId,
        reason: reason.trim().slice(0, 500),
        source: 'public_page',
      });

      if (error) throw error;

      toast.success('Thank you for your report. We will review it.');
      setOpen(false);
      setReason('');
    } catch {
      toast.error('Unable to submit report. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setReason(''); }}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="text-muted-foreground hover:text-foreground text-xs gap-1"
        >
          <Flag className="h-3 w-3" />
          Report
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Report this profile</DialogTitle>
          <DialogDescription>
            If this profile contains inappropriate or inaccurate content,
            let us know and we'll review it.
          </DialogDescription>
        </DialogHeader>
        <Textarea
          placeholder="Describe the issue..."
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          maxLength={500}
          rows={3}
        />
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={submitting || !reason.trim()}>
            {submitting ? 'Submitting…' : 'Submit Report'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
