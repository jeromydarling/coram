import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useAdoptionWeekly } from '@/hooks/useOperatorAdoption';
import { Eye } from 'lucide-react';

const labelColors: Record<string, string> = {
  quiet: 'bg-muted text-muted-foreground',
  warming: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  active: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  thriving: 'bg-primary/10 text-primary',
};

export function AdoptionPulsePanel() {
  const { data, isLoading } = useAdoptionWeekly();
  const [selectedTenant, setSelectedTenant] = useState<any>(null);

  if (isLoading) return <Skeleton className="h-48 w-full" />;

  // Deduplicate by tenant (latest week)
  const latest = new Map<string, any>();
  for (const row of data || []) {
    if (!latest.has(row.tenant_id)) latest.set(row.tenant_id, row);
  }
  const rows = Array.from(latest.values());

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Adoption Pulse</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {rows.length === 0 ? (
          <p className="p-6 text-center text-sm text-muted-foreground">
            No adoption data yet. Run the daily refresh to populate.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tenant</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Score</TableHead>
                <TableHead className="text-right hidden sm:table-cell">Reflections</TableHead>
                <TableHead className="text-right hidden sm:table-cell">NRI Accepted</TableHead>
                <TableHead className="text-right hidden md:table-cell">Signum</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.tenant_id}>
                  <TableCell className="font-medium">
                    {(r as any).tenants?.name || r.tenant_id.slice(0, 8)}
                  </TableCell>
                  <TableCell>
                    <Badge className={labelColors[r.adoption_label] || ''} variant="outline">
                      {r.adoption_label}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">{r.adoption_score}</TableCell>
                  <TableCell className="text-right hidden sm:table-cell">
                    {/* From narrative we can extract, but we show score context */}
                    —
                  </TableCell>
                  <TableCell className="text-right hidden sm:table-cell">—</TableCell>
                  <TableCell className="text-right hidden md:table-cell">—</TableCell>
                  <TableCell>
                    <Sheet>
                      <SheetTrigger asChild>
                        <Button variant="ghost" size="sm" onClick={() => setSelectedTenant(r)}>
                          <Eye className="h-4 w-4" />
                        </Button>
                      </SheetTrigger>
                      <SheetContent>
                        <SheetHeader>
                          <SheetTitle>Week Story</SheetTitle>
                        </SheetHeader>
                        <div className="mt-4 space-y-3">
                          <p className="text-sm text-muted-foreground">
                            Week of {r.week_start}
                          </p>
                          <Badge className={labelColors[r.adoption_label] || ''} variant="outline">
                            {r.adoption_label} — score {r.adoption_score}
                          </Badge>
                          <div className="space-y-2 mt-4">
                            {(Array.isArray(r.narrative) ? r.narrative : []).map((line: string, i: number) => (
                              <p key={i} className="text-sm text-foreground italic">
                                "{line}"
                              </p>
                            ))}
                            {(!r.narrative || (Array.isArray(r.narrative) && r.narrative.length === 0)) && (
                              <p className="text-sm text-muted-foreground">No narrative generated this week.</p>
                            )}
                          </div>
                        </div>
                      </SheetContent>
                    </Sheet>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
