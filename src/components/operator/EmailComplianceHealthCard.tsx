/**
 * EmailComplianceHealthCard — Read-only compliance metrics for Operator Console.
 *
 * WHAT: Shows do_not_email totals, recent unsubscribes, and skipped opt-out events.
 * WHERE: Operator Console → Overview tab.
 * WHY: Gives operators visibility into email compliance health without admin workflows.
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ShieldCheck, UserX, MailX } from 'lucide-react';
import { HelpTooltip } from '@/components/ui/help-tooltip';
const SectionTooltip = HelpTooltip;

export function EmailComplianceHealthCard() {
  const { data, isLoading } = useQuery({
    queryKey: ['operator-email-compliance-health'],
    queryFn: async () => {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const cutoff = sevenDaysAgo.toISOString();

      // Total suppressed emails
      const { count: totalSuppressed } = await supabase
        .from('email_suppressions')
        .select('id', { count: 'exact', head: true });

      // Last 7 days unsubscribes
      const { count: recentUnsubscribes } = await supabase
        .from('email_suppressions')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', cutoff);

      // Skipped opt-out events (from campaign events)
      const { count: skippedOptOuts } = await supabase
        .from('email_campaign_events')
        .select('id', { count: 'exact', head: true })
        .eq('event_type', 'skipped_opt_out');

      return {
        totalSuppressed: totalSuppressed ?? 0,
        recentUnsubscribes: recentUnsubscribes ?? 0,
        skippedOptOuts: skippedOptOuts ?? 0,
      };
    },
    refetchInterval: 120_000,
  });

  return (
    <section>
      <h2 className="text-lg font-semibold text-foreground mb-3">
        Email Compliance Health
        <SectionTooltip
          what="Overview of email suppression totals, recent unsubscribes, and skipped opt-out events"
          where="email_suppressions + email_campaign_events"
          why="Ensures outreach respects do-not-email and compliance requirements"
        />
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="flex items-center gap-3 py-6">
            <div className="h-10 w-10 rounded-full bg-destructive/10 flex items-center justify-center flex-shrink-0">
              <UserX className="h-5 w-5 text-destructive" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Do Not Email Total</p>
              {isLoading ? (
                <Skeleton className="h-6 w-12 mt-1" />
              ) : (
                <p className="text-xl font-bold text-foreground">{data?.totalSuppressed ?? 0}</p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center gap-3 py-6">
            <div className="h-10 w-10 rounded-full bg-accent/20 flex items-center justify-center flex-shrink-0">
              <MailX className="h-5 w-5 text-accent-foreground" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Unsubscribes (7d)</p>
              {isLoading ? (
                <Skeleton className="h-6 w-12 mt-1" />
              ) : (
                <p className="text-xl font-bold text-foreground">{data?.recentUnsubscribes ?? 0}</p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center gap-3 py-6">
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
              <ShieldCheck className="h-5 w-5 text-primary" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Skipped (Opt-Out)</p>
              {isLoading ? (
                <Skeleton className="h-6 w-12 mt-1" />
              ) : (
                <p className="text-xl font-bold text-foreground">{data?.skippedOptOuts ?? 0}</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
