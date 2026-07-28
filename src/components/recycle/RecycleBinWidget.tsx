/**
 * RecycleBinWidget — Recently deleted items for tenants.
 *
 * WHAT: Compact list of soft-deleted records with one-click restore.
 * WHERE: Activity feed / dashboard.
 * WHY: 7-day safety net for accidental deletions.
 */
import { useRecycleBin, useRestoreFromRecycleBin, getEntityLabel } from '@/hooks/useRecycleBin';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Trash2, RotateCcw, Building2, User, MapPin, Calendar, FileText, Heart } from 'lucide-react';
import { formatDistanceToNow, parseISO } from 'date-fns';
import { HelpTooltip } from '@/components/ui/help-tooltip';

const ENTITY_ICONS: Record<string, React.ElementType> = {
  opportunities: Building2,
  contacts: User,
  metros: MapPin,
  events: Calendar,
  grants: FileText,
  volunteers: Heart,
};

export function RecycleBinWidget() {
  const { data: items, isLoading } = useRecycleBin({ limit: 10 });
  const restore = useRestoreFromRecycleBin();

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <Skeleton className="h-5 w-40" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-20 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!items || items.length === 0) return null;

  return (
    <Card className="border-destructive/20">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Trash2 className="w-4 h-4 text-destructive" />
          Recently Deleted
          <Badge variant="secondary" className="text-xs ml-auto">
            {items.length}
          </Badge>
          <HelpTooltip content="Items you deleted in the last 7 days. Restore anything removed by mistake — before it's gone for good." />
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {items.map((item) => {
          const Icon = ENTITY_ICONS[item.entity_type] || Trash2;
          return (
            <div
              key={item.id}
              className="flex items-center gap-3 p-2.5 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
            >
              <div className="p-1.5 rounded bg-destructive/10 shrink-0">
                <Icon className="w-3.5 h-3.5 text-destructive" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-foreground truncate">
                  {item.entity_name || 'Unnamed'}
                </p>
                <p className="text-xs text-muted-foreground">
                  {getEntityLabel(item.entity_type)} · deleted {formatDistanceToNow(parseISO(item.deleted_at), { addSuffix: true })}
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="shrink-0 text-xs gap-1 text-primary hover:text-primary"
                onClick={() => restore.mutate(item.id)}
                disabled={restore.isPending}
              >
                <RotateCcw className="w-3 h-3" />
                Restore
              </Button>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
