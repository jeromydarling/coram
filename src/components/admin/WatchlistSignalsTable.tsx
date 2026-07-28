import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Copy, Signal, Loader2 } from 'lucide-react';
import { toast } from '@/components/ui/sonner';
import { useWatchlistSignals } from '@/hooks/useWatchlistSignals';
import { formatTimestamp } from '@/lib/automationHealthFormatters';

interface Props {
  windowHours: number;
}

export function WatchlistSignalsTable({ windowHours }: Props) {
  const { data: signals, isLoading } = useWatchlistSignals(windowHours);

  const copyId = (id: string) => {
    navigator.clipboard.writeText(id);
    toast.success('ID copied');
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Signal className="w-4 h-4" />
          Latest Watchlist Changes ({signals?.length ?? 0})
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {!signals?.length ? (
          <div className="p-6 text-center text-muted-foreground text-sm">
            No watchlist signals in this window
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Time</TableHead>
                  <TableHead>Org ID</TableHead>
                  <TableHead>Summary</TableHead>
                  <TableHead>Confidence</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>IDs</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {signals.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                      {formatTimestamp(s.created_at)}
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      <div className="flex items-center gap-1">
                        <span>{s.org_id.slice(0, 8)}</span>
                        <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => copyId(s.org_id)}>
                          <Copy className="h-3 w-3" />
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm max-w-[300px] truncate" title={s.summary}>
                      {s.summary}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {Math.round(s.confidence * 100)}%
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {s.signal_type}
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      <div className="flex gap-1">
                        {s.diff_id && (
                          <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => copyId(s.diff_id!)} title="Copy diff ID">
                            <Copy className="h-3 w-3" />
                          </Button>
                        )}
                        {s.snapshot_id && (
                          <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => copyId(s.snapshot_id!)} title="Copy snapshot ID">
                            <Copy className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
