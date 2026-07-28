import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Target,
  MoreHorizontal,
  Check,
  X,
  Loader2,
  ExternalLink,
  Calendar,
  HandshakeIcon,
  UserPlus,
  Search,
  ArrowUpRight,
  FileText,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useRelationshipActions, useUpdateRelationshipAction, type RelationshipAction } from '@/hooks/useRelationshipActions';

const ACTION_ICONS: Record<string, typeof Target> = {
  reach_out: ArrowUpRight,
  introduce: HandshakeIcon,
  attend_event: Calendar,
  apply_grant: FileText,
  follow_up: Target,
  research: Search,
  update_contact: UserPlus,
};

const PRIORITY_STYLES: Record<string, string> = {
  high: 'bg-destructive/15 text-destructive',
  normal: 'bg-warning/15 text-warning',
  low: 'bg-muted text-muted-foreground',
};

function ActionItem({ action }: { action: RelationshipAction }) {
  const update = useUpdateRelationshipAction();
  const Icon = ACTION_ICONS[action.action_type] || Target;
  const priorityStyle = PRIORITY_STYLES[action.priority_label] || PRIORITY_STYLES.normal;

  const evidenceUrls = (action.drivers || [])
    .map((d) => d.source_url)
    .filter(Boolean) as string[];

  return (
    <div className="flex items-start gap-3 p-3 rounded-lg border bg-card hover:bg-accent/30 transition-colors">
      <div className="p-1.5 rounded bg-primary/10 mt-0.5">
        <Icon className="w-3.5 h-3.5 text-primary" />
      </div>
      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium text-foreground">{action.title}</span>
          <Badge className={cn('text-[10px] shrink-0', priorityStyle)}>
            {action.priority_label}
          </Badge>
          {action.suggested_timing && (
            <span className="text-[10px] text-muted-foreground">{action.suggested_timing}</span>
          )}
        </div>
        <p className="text-xs text-muted-foreground line-clamp-2">{action.summary}</p>
        {evidenceUrls.length > 0 && (
          <div className="flex gap-1 mt-1">
            {evidenceUrls.slice(0, 2).map((url, i) => (
              <a
                key={i}
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[10px] text-primary hover:underline flex items-center gap-0.5"
                onClick={(e) => e.stopPropagation()}
              >
                <ExternalLink className="w-2.5 h-2.5" /> Source
              </a>
            ))}
          </div>
        )}
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0 shrink-0">
            {update.isPending ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <MoreHorizontal className="w-3.5 h-3.5" />
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => update.mutate({ id: action.id, status: 'done' })}>
            <Check className="w-3.5 h-3.5 mr-2" /> Mark Done
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => update.mutate({ id: action.id, status: 'dismissed' })}>
            <X className="w-3.5 h-3.5 mr-2" /> Dismiss
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

interface RelationshipActionsCardProps {
  opportunityId: string;
}

export function RelationshipActionsCard({ opportunityId }: RelationshipActionsCardProps) {
  const { data: actions, isLoading } = useRelationshipActions(opportunityId);

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Target className="w-4 h-4 text-primary" /> Relationship Actions
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  if (!actions || actions.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Target className="w-4 h-4 text-primary" />
              Relationship Actions
            </CardTitle>
            <CardDescription className="text-xs">
              Evidence-backed actions ranked by priority
            </CardDescription>
          </div>
          <Badge variant="secondary" className="text-xs">{actions.length}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {actions.map((action) => (
          <ActionItem key={action.id} action={action} />
        ))}
      </CardContent>
    </Card>
  );
}
