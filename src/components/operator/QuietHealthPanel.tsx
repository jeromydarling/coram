import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { useJobHealth } from '@/hooks/useOperatorAdoption';
import { formatDistanceToNow } from 'date-fns';

const statusColors: Record<string, string> = {
  ok: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  warning: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  error: 'bg-destructive/10 text-destructive',
};

export function QuietHealthPanel() {
  const { data, isLoading } = useJobHealth();

  if (isLoading) return <Skeleton className="h-48 w-full" />;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Quiet Health</CardTitle>
        <p className="text-xs text-muted-foreground">Gentle rhythms of the background systems.</p>
      </CardHeader>
      <CardContent className="p-0">
        {!data?.length ? (
          <p className="p-6 text-center text-sm text-muted-foreground">No job health data yet.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Job</TableHead>
                <TableHead>Cadence</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="hidden sm:table-cell">Last OK</TableHead>
                <TableHead className="hidden md:table-cell">Stats</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((j) => (
                <TableRow key={j.id}>
                  <TableCell className="font-medium font-mono text-xs">{j.job_key}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{j.cadence}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge className={statusColors[j.last_status] || ''} variant="outline">
                      {j.last_status}
                    </Badge>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">
                    {j.last_ok_at
                      ? formatDistanceToNow(new Date(j.last_ok_at), { addSuffix: true })
                      : '—'}
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-xs text-muted-foreground max-w-[200px] truncate">
                    {j.last_stats && typeof j.last_stats === 'object'
                      ? Object.entries(j.last_stats as Record<string, unknown>)
                          .slice(0, 3)
                          .map(([k, v]) => `${k}: ${v}`)
                          .join(', ')
                      : '—'}
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
