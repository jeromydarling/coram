import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

/**
 * Org-level "last outreach" attribution.
 * Computed from email_campaign_audience + email_campaigns.
 */
export interface OrgLastOutreach {
  opportunity_id: string;
  last_outreach_at: string;
  last_campaign_id: string;
  last_campaign_name: string;
  last_outreach_status: 'sent' | 'failed' | 'mixed';
  sent_count: number;
  failed_count: number;
}

export function useOrgLastOutreach() {
  return useQuery<OrgLastOutreach[]>({
    queryKey: ['org-last-outreach'],
    queryFn: async () => {
      // Get audience rows that have an opportunity_id, grouped by opportunity
      const { data: audienceRows, error } = await supabase
        .from('email_campaign_audience')
        .select('opportunity_id, campaign_id, status, sent_at')
        .not('opportunity_id', 'is', null)
        .in('status', ['sent', 'failed'])
        .order('sent_at', { ascending: false });

      if (error) throw error;
      if (!audienceRows || audienceRows.length === 0) return [];

      // Group by opportunity_id, take most recent campaign
      const orgMap = new Map<string, {
        opportunity_id: string;
        campaign_id: string;
        sent_at: string;
        sent_count: number;
        failed_count: number;
      }>();

      for (const row of audienceRows) {
        if (!row.opportunity_id) continue;
        const existing = orgMap.get(row.opportunity_id);
        if (!existing) {
          orgMap.set(row.opportunity_id, {
            opportunity_id: row.opportunity_id,
            campaign_id: row.campaign_id,
            sent_at: row.sent_at || '',
            sent_count: row.status === 'sent' ? 1 : 0,
            failed_count: row.status === 'failed' ? 1 : 0,
          });
        } else {
          if (row.status === 'sent') existing.sent_count++;
          else existing.failed_count++;
          // Keep the most recent campaign
          if (row.sent_at && row.sent_at > existing.sent_at) {
            existing.campaign_id = row.campaign_id;
            existing.sent_at = row.sent_at;
          }
        }
      }

      // Look up campaign names
      const campaignIds = [...new Set([...orgMap.values()].map((v) => v.campaign_id))];
      const { data: campaigns } = await supabase
        .from('email_campaigns')
        .select('id, name')
        .in('id', campaignIds);

      const campaignNames = new Map((campaigns || []).map((c) => [c.id, c.name]));

      return [...orgMap.values()].map((v) => {
        let status: 'sent' | 'failed' | 'mixed' = 'sent';
        if (v.failed_count > 0 && v.sent_count === 0) status = 'failed';
        else if (v.failed_count > 0 && v.sent_count > 0) status = 'mixed';

        return {
          opportunity_id: v.opportunity_id,
          last_outreach_at: v.sent_at,
          last_campaign_id: v.campaign_id,
          last_campaign_name: campaignNames.get(v.campaign_id) || 'Unknown',
          last_outreach_status: status,
          sent_count: v.sent_count,
          failed_count: v.failed_count,
        };
      });
    },
    staleTime: 60_000,
  });
}

/**
 * Current-month email usage for billing.
 */
export function useEmailBillingUsage() {
  return useQuery({
    queryKey: ['email-billing-usage'],
    queryFn: async () => {
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

      const { data, error } = await supabase
        .from('usage_events')
        .select('event_type, quantity, unit, occurred_at')
        .eq('workflow_key', 'gmail_campaign')
        .gte('occurred_at', monthStart);

      if (error) throw error;

      let emailsSent = 0;
      let emailsFailed = 0;
      const dailyMap = new Map<string, { sent: number; failed: number }>();

      for (const row of data || []) {
        const qty = Number(row.quantity) || 0;
        const date = (row.occurred_at as string).slice(0, 10);
        const existing = dailyMap.get(date) || { sent: 0, failed: 0 };

        if (row.event_type === 'email_sent') {
          emailsSent += qty;
          existing.sent += qty;
        } else if (row.event_type === 'email_failed') {
          emailsFailed += qty;
          existing.failed += qty;
        }

        dailyMap.set(date, existing);
      }

      const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
      const dayOfMonth = now.getDate();
      const projectedSent = dayOfMonth > 0 ? Math.round((emailsSent / dayOfMonth) * daysInMonth) : 0;

      return {
        emailsSent,
        emailsFailed,
        projectedSent,
        dayOfMonth,
        daysInMonth,
        dailyBreakdown: [...dailyMap.entries()]
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([date, counts]) => ({ date, ...counts })),
      };
    },
    staleTime: 120_000,
  });
}
