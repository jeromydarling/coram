/**
 * ExportStatsPanel — Operator Console panel for Testimonium export stats.
 *
 * WHAT: Shows last_export_at and export_count per tenant.
 * WHERE: Operator Console, Adoption tab.
 * WHY: Admin visibility into narrative export adoption.
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { FileText } from 'lucide-react';
import { format } from 'date-fns';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { HelpCircle } from 'lucide-react';

export function ExportStatsPanel() {
  const { data, isLoading } = useQuery({
    queryKey: ['operator-export-stats'],
    queryFn: async () => {
      // Aggregate from testimonium_exports (admin-only RLS)
      const { data, error } = await supabase
        .from('testimonium_exports')
        .select('tenant_id, created_at')
        .order('created_at', { ascending: false })
        .limit(500);
      if (error) throw error;

      // Group by tenant
      const map: Record<string, { count: number; last: string }> = {};
      for (const row of data || []) {
        if (!map[row.tenant_id]) {
          map[row.tenant_id] = { count: 0, last: row.created_at };
        }
        map[row.tenant_id].count++;
      }
      return Object.entries(map).map(([tid, v]) => ({
        tenant_id: tid,
        export_count: v.count,
        last_export_at: v.last,
      }));
    },
  });

  return (
    <Card className="rounded-xl">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <FileText className="h-4 w-4 text-primary" />
          Narrative Export Activity
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <HelpCircle className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
              </TooltipTrigger>
              <TooltipContent className="max-w-xs text-xs">
                <p><strong>What:</strong> Testimonium export counts per tenant</p>
                <p><strong>Where:</strong> testimonium_exports</p>
                <p><strong>Why:</strong> Track narrative export adoption</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-24 w-full" />
        ) : data && data.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tenant</TableHead>
                <TableHead className="text-right">Exports</TableHead>
                <TableHead className="text-right">Last Export</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((row) => (
                <TableRow key={row.tenant_id}>
                  <TableCell className="font-mono text-xs truncate max-w-[120px]">
                    {row.tenant_id.slice(0, 8)}…
                  </TableCell>
                  <TableCell className="text-right">{row.export_count}</TableCell>
                  <TableCell className="text-right text-xs text-muted-foreground">
                    {format(new Date(row.last_export_at), 'MMM d, yyyy')}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-6 italic">
            No exports generated yet.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
