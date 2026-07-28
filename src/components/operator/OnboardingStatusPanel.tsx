/**
 * OnboardingStatusPanel — Operator Console view of tenant onboarding progress.
 *
 * WHAT: Admin-only table showing onboarding status per tenant.
 * WHERE: Operator Console (/admin/operator).
 * WHY: Allows admins to observe adoption without interrupting tenants.
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { HelpCircle } from 'lucide-react';

export function OnboardingStatusPanel() {
  const { data: sessions, isLoading } = useQuery({
    queryKey: ['operator-onboarding-status'],
    queryFn: async () => {
      // Get all onboarding sessions with tenant info
      const { data: sessionsData, error: sessionsErr } = await supabase
        .from('onboarding_sessions')
        .select('tenant_id, archetype, status, started_at, completed_at')
        .order('started_at', { ascending: false })
        .limit(100);
      if (sessionsErr) throw sessionsErr;

      if (!sessionsData || sessionsData.length === 0) return [];

      // Get tenant names
      const tenantIds = sessionsData.map(s => s.tenant_id);
      const { data: tenants } = await supabase
        .from('tenants')
        .select('id, name, slug')
        .in('id', tenantIds);

      const tenantMap = new Map((tenants ?? []).map(t => [t.id, t]));

      // Get progress counts per tenant
      const { data: allProgress } = await supabase
        .from('onboarding_progress')
        .select('tenant_id, status')
        .in('tenant_id', tenantIds);

      const progressCounts = new Map<string, { total: number; done: number }>();
      for (const p of allProgress ?? []) {
        const entry = progressCounts.get(p.tenant_id) ?? { total: 0, done: 0 };
        entry.total++;
        if (p.status === 'complete' || p.status === 'skipped') entry.done++;
        progressCounts.set(p.tenant_id, entry);
      }

      // Get value moments per tenant
      const { data: moments } = await supabase
        .from('operator_value_moments')
        .select('tenant_id')
        .in('tenant_id', tenantIds)
        .limit(500);

      const momentTenants = new Set((moments ?? []).map(m => m.tenant_id));

      return sessionsData.map(s => ({
        ...s,
        tenant_name: tenantMap.get(s.tenant_id)?.name ?? 'Unknown',
        tenant_slug: tenantMap.get(s.tenant_id)?.slug ?? '',
        progress: progressCounts.get(s.tenant_id) ?? { total: 0, done: 0 },
        has_value_moment: momentTenants.has(s.tenant_id),
      }));
    },
  });

  const statusBadge = (status: string) => {
    if (status === 'completed') return <Badge variant="default" className="text-xs">completed</Badge>;
    if (status === 'in_progress') return <Badge variant="secondary" className="text-xs">in progress</Badge>;
    return <Badge variant="outline" className="text-xs">not started</Badge>;
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <CardTitle className="text-base">Onboarding Status</CardTitle>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
              </TooltipTrigger>
              <TooltipContent side="right" className="max-w-xs text-xs space-y-1">
                <p><strong>What:</strong> Per-tenant onboarding progress tracking.</p>
                <p><strong>Where:</strong> Aggregated from onboarding_sessions + onboarding_progress.</p>
                <p><strong>Why:</strong> Observe adoption patterns without interrupting tenants.</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {isLoading ? (
          <div className="p-6">
            <Skeleton className="h-40 w-full" />
          </div>
        ) : sessions && sessions.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tenant</TableHead>
                <TableHead>Archetype</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Progress</TableHead>
                <TableHead className="text-center hidden sm:table-cell">Value Moment</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sessions.map(s => (
                <TableRow key={s.tenant_id}>
                  <TableCell className="font-medium">{s.tenant_name}</TableCell>
                  <TableCell className="capitalize text-sm">{s.archetype?.replace(/_/g, ' ')}</TableCell>
                  <TableCell>{statusBadge(s.status)}</TableCell>
                  <TableCell className="text-right text-sm">
                    {s.progress.total > 0
                      ? `${Math.round((s.progress.done / s.progress.total) * 100)}%`
                      : '—'}
                  </TableCell>
                  <TableCell className="text-center hidden sm:table-cell">
                    {s.has_value_moment ? (
                      <Badge variant="default" className="text-[10px]">yes</Badge>
                    ) : (
                      <span className="text-muted-foreground text-xs">—</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <div className="py-8 text-center text-sm text-muted-foreground">
            No onboarding sessions yet.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
