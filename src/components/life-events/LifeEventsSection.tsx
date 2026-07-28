/**
 * LifeEventsSection — Displays and manages life events for a Person.
 *
 * WHAT: Chronological list of structured life events with add/remove actions.
 * WHERE: PersonDetail page.
 * WHY: Narrative ontology — the seasons of a life shape how we relate.
 */

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Heart, Plus, Trash2, Loader2, Eye, EyeOff, Sparkles } from 'lucide-react';
import { useLifeEvents, LIFE_EVENT_TYPES } from '@/hooks/useLifeEvents';
import { AddLifeEventDialog } from './AddLifeEventDialog';
import { format } from 'date-fns';
import { HelpTooltip } from '@/components/ui/help-tooltip';

interface Props {
  personId: string;
  personName: string;
  entityType?: 'person' | 'partner';
}

const TYPE_LABELS: Record<string, string> = Object.fromEntries(
  LIFE_EVENT_TYPES.map(t => [t.value, t.label])
);

function visibilityIcon(vis: string) {
  if (vis === 'private') return <EyeOff className="w-3 h-3" />;
  return <Eye className="w-3 h-3" />;
}

export function LifeEventsSection({ personId, personName, entityType = 'person' }: Props) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const { events, isLoading, create, isCreating, remove } = useLifeEvents(personId, entityType);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            Life Events
            <HelpTooltip
              what="Structured moments that shape a person's story — beginnings, milestones, and endings."
              where="Person detail page"
              why="Life events provide narrative context across seasons and inform compassionate care."
            />
          </CardTitle>
          <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setDialogOpen(true)}>
            <Plus className="w-3.5 h-3.5" />
            Add
          </Button>
        </div>
      </CardHeader>

      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : events.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">
            No life events recorded yet.
          </p>
        ) : (
          <div className="space-y-3">
            {events.map(evt => (
              <div
                key={evt.id}
                className="flex items-start justify-between gap-3 rounded-lg border border-border/60 p-3 group"
              >
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="secondary" className="text-xs">
                      {TYPE_LABELS[evt.event_type] ?? evt.event_type}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {evt.event_type === 'birthday' && !evt.event_year
                        ? `${format(new Date(evt.event_date), 'MMM d')}`
                        : format(new Date(evt.event_date), 'MMM d, yyyy')}
                    </span>
                    <span className="text-xs text-muted-foreground flex items-center gap-0.5">
                      {visibilityIcon(evt.visibility)}
                    </span>
                    {evt.remind_enabled && (
                      <span className="text-xs text-muted-foreground">🔔</span>
                    )}
                  </div>
                  {evt.title && (
                    <p className="text-sm font-medium truncate">{evt.title}</p>
                  )}
                  {evt.description && (
                    <p className="text-xs text-muted-foreground line-clamp-2">{evt.description}</p>
                  )}
                </div>

                <Button
                  variant="ghost"
                  size="icon"
                  className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0 h-7 w-7"
                  onClick={() => remove(evt.id)}
                >
                  <Trash2 className="w-3.5 h-3.5 text-destructive" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      <AddLifeEventDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSubmit={create}
        isSubmitting={isCreating}
      />
    </Card>
  );
}
