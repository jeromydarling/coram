/**
 * CampaignBanner — Persistent post-import banner for drafting email campaigns.
 *
 * WHAT: Shows a dismissible banner with a "Draft Campaign" CTA after CSV import.
 * WHERE: People page, rendered above the grid after a successful import with emails.
 * WHY: Ensures the campaign CTA survives the import modal closing.
 */

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Mail, X, Loader2 } from 'lucide-react';

interface CampaignBannerProps {
  emailCount: number;
  onDraftCampaign: () => void;
  onDismiss: () => void;
  isPending?: boolean;
}

export function CampaignBanner({ emailCount, onDraftCampaign, onDismiss, isPending }: CampaignBannerProps) {
  if (emailCount <= 0) return null;

  return (
    <Alert className="border-primary/20 bg-primary/5 relative">
      <Mail className="h-4 w-4 text-primary" />
      <AlertDescription className="flex flex-col sm:flex-row sm:items-center gap-3 pr-8">
        <span className="flex-1 text-sm">
          {emailCount} imported {emailCount === 1 ? 'contact has' : 'contacts have'} email addresses — ready to draft a campaign.
        </span>
        <div className="flex gap-2 shrink-0">
          <Button variant="outline" size="sm" onClick={onDismiss}>
            Dismiss
          </Button>
          <Button size="sm" onClick={onDraftCampaign} disabled={isPending}>
            {isPending && <Loader2 className="w-3 h-3 mr-1 animate-spin" />}
            Draft Campaign
          </Button>
        </div>
      </AlertDescription>
      <button
        type="button"
        onClick={onDismiss}
        className="absolute right-3 top-3 rounded-sm opacity-70 hover:opacity-100"
      >
        <X className="h-3 h-3" />
        <span className="sr-only">Dismiss</span>
      </button>
    </Alert>
  );
}
