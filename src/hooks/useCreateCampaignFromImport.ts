/**
 * useCreateCampaignFromImport — Creates a draft campaign + audience from imported contacts.
 *
 * WHAT: After CSV import, creates an email_campaigns row and populates email_campaign_audience.
 * WHERE: Used by People page after a successful contact import.
 * WHY: Enables one-click campaign drafting from freshly imported contacts with emails.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/components/ui/sonner';

export interface ImportedContactForCampaign {
  email: string;
  name?: string;
  contactId?: string;
  opportunityId?: string;
  organization?: string;
}

const DEFAULT_HTML_BODY = `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <p>Hi {{ contact.FIRSTNAME }},</p>
  <p>I hope this message finds you well. I'm reaching out from PCs for People regarding a potential partnership opportunity with {{ contact.ORGANIZATION }}.</p>
  <p>We provide affordable refurbished computers and internet access to underserved communities, and I believe there's a strong alignment between our missions.</p>
  <p>I'd love to schedule a brief call to explore how we might work together. Would you have 15 minutes this week or next?</p>
  <p>Best regards,<br/>{{ sender.NAME }}</p>
</div>`;

export function useCreateCampaignFromImport() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (contacts: ImportedContactForCampaign[]) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Create the campaign
      const { data: campaign, error: campaignError } = await supabase
        .from('email_campaigns')
        .insert({
          name: `Import Campaign — ${new Date().toLocaleDateString()}`,
          subject: 'Partnership Opportunity - {{ contact.ORGANIZATION }}',
          html_body: DEFAULT_HTML_BODY,
          status: 'draft',
          created_by: user.id,
          audience_count: contacts.length,
        })
        .select()
        .single();

      if (campaignError) throw campaignError;

      // Populate audience with status 'queued'
      const audienceRows = contacts.map(c => ({
        campaign_id: campaign.id,
        email: c.email.toLowerCase().trim(),
        name: c.name || null,
        contact_id: c.contactId || null,
        opportunity_id: c.opportunityId || null,
        source: 'import' as const,
        status: 'queued',
        fingerprint: `${campaign.id}:${c.email.toLowerCase().trim()}`,
      }));

      // Insert in chunks of 100
      for (let i = 0; i < audienceRows.length; i += 100) {
        const chunk = audienceRows.slice(i, i + 100);
        const { error: audienceError } = await supabase
          .from('email_campaign_audience')
          .upsert(chunk, { onConflict: 'campaign_id,email' });

        if (audienceError) {
          console.warn('Audience insert error:', audienceError.message);
        }
      }

      return campaign;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['email-campaigns'] });
      toast.success('Draft campaign created with imported contacts');
    },
    onError: (error) => {
      toast.error(`Failed to create campaign: ${error.message}`);
    },
  });
}
