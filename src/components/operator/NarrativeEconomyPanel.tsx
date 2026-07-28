/**
 * NarrativeEconomyPanel — Operator Console panel for narrative economy visibility.
 *
 * WHAT: Shows emerging story counts and last detected moments per tenant.
 * WHERE: /admin/operator → Adoption tab
 * WHY: Admin observes narrative value without interrupting tenants.
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { BookOpen } from 'lucide-react';
import { format } from 'date-fns';
import { HelpTooltip } from '@/components/ui/help-tooltip';
const SectionTooltip = HelpTooltip;

interface TenantNarrativeRow {
  tenant_id: string;
  tenant_name: string;
  emerging_drafts: number;
  last_moment_at: string | null;
  moment_count_7d: number;
}

export function NarrativeEconomyPanel() {
  const { data, isLoading } = useQuery<TenantNarrativeRow[]>({
    queryKey: ['operator-narrative-economy'],
    queryFn: async () => {
      // Get tenants
      const { data: tenants } = await supabase
        .from('tenants')
        .select('id, name')
        .limit(200);

      if (!tenants?.length) return [];

      const weekAgo = new Date();
      weekAgo.setUTCDate(weekAgo.getUTCDate() - 7);

      // Get draft counts per tenant
      const { data: drafts } = await supabase
        .from('narrative_story_drafts')
        .select('tenant_id')
        .eq('status', 'emerging');

      // Get recent moments
      const { data: moments } = await supabase
        .from('narrative_value_moments')
        .select('tenant_id, occurred_at')
        .gte('occurred_at', weekAgo.toISOString())
        .order('occurred_at', { ascending: false });

      const draftCounts = new Map<string, number>();
      for (const d of drafts || []) {
        draftCounts.set(d.tenant_id, (draftCounts.get(d.tenant_id) || 0) + 1);
      }

      const momentData = new Map<string, { count: number; last: string }>();
      for (const m of moments || []) {
        const existing = momentData.get(m.tenant_id);
        if (!existing) {
          momentData.set(m.tenant_id, { count: 1, last: m.occurred_at });
        } else {
          existing.count++;
        }
      }

      return tenants.map((t) => ({
        tenant_id: t.id,
        tenant_name: t.name,
        emerging_drafts: draftCounts.get(t.id) || 0,
        last_moment_at: momentData.get(t.id)?.last || null,
        moment_count_7d: momentData.get(t.id)?.count || 0,
      })).filter((r) => r.emerging_drafts > 0 || r.moment_count_7d > 0);
    },
    refetchInterval: 5 * 60_000,
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <BookOpen className="h-4 w-4" />
          Narrative Economy
          <SectionTooltip
            what="Emerging stories and value moments across tenants"
            where="narrative_story_drafts + narrative_value_moments"
            why="Observe the story engine producing value quietly"
          />
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-32 w-full" />
        ) : data && data.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tenant</TableHead>
                <TableHead className="text-right">Stories</TableHead>
                <TableHead className="text-right">Moments (7d)</TableHead>
                <TableHead className="hidden sm:table-cell">Last Moment</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((r) => (
                <TableRow key={r.tenant_id}>
                  <TableCell className="font-medium">{r.tenant_name}</TableCell>
                  <TableCell className="text-right">
                    {r.emerging_drafts > 0 ? (
                      <Badge variant="secondary">{r.emerging_drafts}</Badge>
                    ) : '—'}
                  </TableCell>
                  <TableCell className="text-right">{r.moment_count_7d}</TableCell>
                  <TableCell className="hidden sm:table-cell text-muted-foreground text-xs">
                    {r.last_moment_at ? format(new Date(r.last_moment_at), 'MMM d, h:mm a') : '—'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-6">
            No narrative activity detected yet. Stories will emerge as tenants build relationships.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
