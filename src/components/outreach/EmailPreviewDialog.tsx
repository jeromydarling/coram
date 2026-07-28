import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { usePreviewEmail } from '@/hooks/useGmailCampaignSend';
import { sanitizeHtml } from '@/lib/sanitize';

interface EmailPreviewDialogProps {
  campaignId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EmailPreviewDialog({ campaignId, open, onOpenChange }: EmailPreviewDialogProps) {
  const preview = usePreviewEmail();
  const [previewData, setPreviewData] = useState<{
    subject: string;
    body_html: string;
    rendered_to: Record<string, string>;
  } | null>(null);

  const handleGenerate = async () => {
    const result = await preview.mutateAsync({ campaignId });
    setPreviewData(result);
  };

  // Auto-generate on open
  if (open && !previewData && !preview.isPending) {
    handleGenerate();
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) setPreviewData(null); }}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Email Preview</DialogTitle>
        </DialogHeader>

        {preview.isPending ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : previewData ? (
          <div className="space-y-4">
            <div className="bg-muted p-3 rounded space-y-1">
              <p className="text-sm"><span className="font-medium">To:</span> {previewData.rendered_to.email}</p>
              <p className="text-sm"><span className="font-medium">Subject:</span> {previewData.subject}</p>
            </div>
            <div
              className="border rounded p-4 prose prose-sm max-w-none"
              dangerouslySetInnerHTML={{ __html: sanitizeHtml(previewData.body_html) }}
            />
            <Button variant="outline" onClick={handleGenerate} disabled={preview.isPending}>
              Refresh Preview
            </Button>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground py-4">No preview available</p>
        )}
      </DialogContent>
    </Dialog>
  );
}
