import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Camera, Copy, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useOrgSnapshots } from '@/hooks/useOrgWatchlist';
import { format, parseISO } from 'date-fns';
import { toast } from '@/components/ui/sonner';

interface RecentSnapshotsPanelProps {
  orgId: string;
}

export function RecentSnapshotsPanel({ orgId }: RecentSnapshotsPanelProps) {
  const { data: snapshots, isLoading } = useOrgSnapshots(orgId);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-6">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Camera className="w-4 h-4" />
          Recent Snapshots ({snapshots?.length ?? 0})
        </CardTitle>
      </CardHeader>
      <CardContent>
        {!snapshots?.length ? (
          <p className="text-sm text-muted-foreground">No snapshots yet</p>
        ) : (
          <div className="space-y-2">
            {snapshots.map((snap) => (
              <div
                key={snap.id}
                className="flex items-center justify-between p-2 rounded-lg bg-muted/30 text-sm"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-muted-foreground">
                    {format(parseISO(snap.crawled_at), 'MMM d, yyyy h:mm a')}
                  </p>
                  <p className="font-mono text-xs text-muted-foreground truncate">
                    {snap.content_hash.slice(0, 16)}…
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0 flex-shrink-0"
                  onClick={() => {
                    navigator.clipboard.writeText(snap.id);
                    toast.success('Snapshot ID copied');
                  }}
                >
                  <Copy className="w-3.5 h-3.5" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
