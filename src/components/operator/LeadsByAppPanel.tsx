/**
 * LeadsByAppPanel — Cosmos rollup: portfolio-wide lead flow by app.
 *
 * WHAT: Renders the operator_leads_by_app view as a sortable card grid + table.
 *       Powers the first concrete piece of the federated Gardener Console.
 * WHERE: Operator Console → "Leads by App" tab (also embeddable in Crescere
 *        → Cosmos when that lands).
 * WHY: One screen replaces 17 separate "did anyone fill out my form?" checks.
 */

import { useMemo, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { format, formatDistanceToNow } from 'date-fns';
import { Sprout, TrendingUp, AlertTriangle, Inbox } from 'lucide-react';

interface LeadsByAppRow {
  source_app: string;
  total: number;
  last_24h: number;
  last_7d: number;
  last_30d: number;
  new_count: number;
  spam_count: number;
  won_count: number;
  converted_count: number;
  conversion_pct: number | null;
  last_lead_at: string | null;
}

const APP_DISPLAY: Record<string, string> = {
  thecros: 'CROS',
  theschola: 'Schola',
  hortus: 'Hortus',
  refugium: 'Refugium',
  resurrectio: 'Resurrectio',
  transitus: 'Transitus',
  vigilia: 'Vigilia',
  communis: 'Communis',
  propria: 'Propria',
  cormundum: 'Cormundum',
  bitoku: 'Bitoku',
  rehearso: 'Rehearso',
  'heritage-kitchen': 'Heritage Kitchen',
  'via-publica': 'Via Publica',
  'fabrica-forge': 'Fabrica Forge',
  'catholic-insurance': 'Catholic Insurance',
  vrtmethod: 'VRT Method',
  thegreatnave: 'The Great Nave',
  unknown: 'Unknown / Untagged',
};

function appLabel(slug: string): string {
  return APP_DISPLAY[slug] ?? slug;
}

export function LeadsByAppPanel() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['operator-leads-by-app'],
    queryFn: async (): Promise<LeadsByAppRow[]> => {
      const { data, error } = await (supabase as any)
        .from('operator_leads_by_app')
        .select('*');
      if (error) throw error;
      return (data ?? []) as LeadsByAppRow[];
    },
    refetchInterval: 60_000,
  });

  const totals = useMemo(() => {
    if (!data) return { total: 0, last_24h: 0, last_7d: 0, conversion: 0 };
    const total = data.reduce((s, r) => s + r.total, 0);
    const last_24h = data.reduce((s, r) => s + r.last_24h, 0);
    const last_7d = data.reduce((s, r) => s + r.last_7d, 0);
    const converted = data.reduce((s, r) => s + r.converted_count, 0);
    const nonSpam = data.reduce((s, r) => s + (r.total - r.spam_count), 0);
    const conversion = nonSpam > 0 ? Math.round((100 * converted) / nonSpam) : 0;
    return { total, last_24h, last_7d, conversion };
  }, [data]);

  const sorted = useMemo(() => {
    if (!data) return [];
    return [...data].sort((a, b) => b.last_7d - a.last_7d || b.total - a.total);
  }, [data]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-6 text-sm text-destructive">
          Could not load leads-by-app rollup: {(error as Error).message}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top-line KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard icon={<Inbox className="w-4 h-4" />} label="Leads (all-time)" value={totals.total.toLocaleString()} />
        <KpiCard icon={<Sprout className="w-4 h-4" />} label="Last 24h" value={totals.last_24h.toString()} accent />
        <KpiCard icon={<TrendingUp className="w-4 h-4" />} label="Last 7d" value={totals.last_7d.toString()} />
        <KpiCard icon={<AlertTriangle className="w-4 h-4" />} label="Conversion (non-spam)" value={`${totals.conversion}%`} />
      </div>

      {/* Per-app table */}
      <Card>
        <CardHeader>
          <CardTitle className="font-serif">Leads by App</CardTitle>
          <CardDescription>
            One row per app in the CROS family. Sorted by 7-day volume.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>App</TableHead>
                <TableHead className="text-right">24h</TableHead>
                <TableHead className="text-right">7d</TableHead>
                <TableHead className="text-right">30d</TableHead>
                <TableHead className="text-right">All-time</TableHead>
                <TableHead className="text-right">New</TableHead>
                <TableHead className="text-right">Spam</TableHead>
                <TableHead className="text-right">Conv.</TableHead>
                <TableHead className="text-right">Last lead</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.length === 0 && (
                <TableRow>
                  <TableCell colSpan={9} className="text-center text-muted-foreground py-6">
                    No leads recorded yet. Once apps start posting, they'll appear here.
                  </TableCell>
                </TableRow>
              )}
              {sorted.map((row) => (
                <TableRow key={row.source_app}>
                  <TableCell>
                    <div className="font-medium">{appLabel(row.source_app)}</div>
                    <code className="text-[11px] text-muted-foreground">{row.source_app}</code>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{row.last_24h}</TableCell>
                  <TableCell className="text-right tabular-nums">{row.last_7d}</TableCell>
                  <TableCell className="text-right tabular-nums">{row.last_30d}</TableCell>
                  <TableCell className="text-right tabular-nums">{row.total}</TableCell>
                  <TableCell className="text-right">
                    {row.new_count > 0 ? <Badge variant="default">{row.new_count}</Badge> : <span className="text-muted-foreground">0</span>}
                  </TableCell>
                  <TableCell className="text-right">
                    {row.spam_count > 0 ? <Badge variant="outline" className="text-muted-foreground">{row.spam_count}</Badge> : <span className="text-muted-foreground">0</span>}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {row.conversion_pct == null ? '—' : `${row.conversion_pct}%`}
                  </TableCell>
                  <TableCell className="text-right text-xs text-muted-foreground" title={row.last_lead_at ? format(new Date(row.last_lead_at), 'PPpp') : ''}>
                    {row.last_lead_at ? formatDistanceToNow(new Date(row.last_lead_at), { addSuffix: true }) : '—'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function KpiCard({ icon, label, value, accent }: { icon: ReactNode; label: string; value: string; accent?: boolean }) {
  return (
    <Card className={accent ? 'border-primary/30 bg-primary/5' : ''}>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {icon}
          <span>{label}</span>
        </div>
        <div className="mt-1 text-2xl font-semibold tabular-nums">{value}</div>
      </CardContent>
    </Card>
  );
}

export default LeadsByAppPanel;
