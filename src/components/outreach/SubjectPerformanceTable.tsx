import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, BarChart3 } from 'lucide-react';
import { useSubjectStats } from '@/hooks/useSubjectStats';
import { format } from 'date-fns';

export function SubjectPerformanceTable() {
  const { data: stats = [], isLoading } = useSubjectStats();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5" />
          Subject Performance
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : stats.length === 0 ? (
          <p className="text-center py-8 text-sm text-muted-foreground">
            No subject data yet. Stats populate after campaigns are sent.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Subject</TableHead>
                <TableHead className="text-right w-20">Sent</TableHead>
                <TableHead className="text-right w-20">Failed</TableHead>
                <TableHead className="text-right w-32">Last Used</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {stats.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="font-medium truncate max-w-[300px]" title={s.subject}>
                    {s.subject}
                  </TableCell>
                  <TableCell className="text-right text-green-600 font-medium">
                    {s.sent_count}
                  </TableCell>
                  <TableCell className="text-right text-destructive font-medium">
                    {s.failed_count}
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground text-sm">
                    {s.last_used_at ? format(new Date(s.last_used_at), 'MMM d, yyyy') : '—'}
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
