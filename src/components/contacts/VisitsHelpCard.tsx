/**
 * VisitsHelpCard — Shows visit + project history for a person.
 *
 * WHAT: Displays last visit/project date, who was present, and excerpt of notes.
 * WHERE: PersonDetail page — only if person has visits or projects (subject_contact_id match).
 * WHY: Makes relational accompaniment visible — both visits and good works.
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Heart, Users, Calendar, ChevronDown, ChevronUp, Hammer } from 'lucide-react';
import { usePersonVisits } from '@/hooks/useActivityParticipants';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format, differenceInDays } from 'date-fns';
import { useState } from 'react';
import { useTenantNavigate } from '@/hooks/useTenantPath';
import { useTranslation } from 'react-i18next';

interface VisitsHelpCardProps {
  contactId: string;
  contactName: string;
}

export function VisitsHelpCard({ contactId, contactName }: VisitsHelpCardProps) {
  const { t } = useTranslation('relationships');
  const { data: visits, isLoading: visitsLoading } = usePersonVisits(contactId);
  const [expanded, setExpanded] = useState(false);
  const navigate = useTenantNavigate();

  // Also fetch Projects where this person is subject_contact_id
  const { data: projects = [], isLoading: projectsLoading } = useQuery({
    queryKey: ['person-projects', contactId],
    enabled: !!contactId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('activities')
        .select('id, title, activity_date_time, notes, project_status')
        .eq('subject_contact_id', contactId)
        .eq('activity_type', 'Project' as any)
        .order('activity_date_time', { ascending: false })
        .limit(10);
      if (error) throw error;
      return data || [];
    },
  });

  const isLoading = visitsLoading || projectsLoading;
  const hasVisits = visits && visits.length > 0;
  const hasProjects = projects.length > 0;

  if (isLoading || (!hasVisits && !hasProjects)) return null;

  const allItems = [
    ...(visits || []).map((v: any) => ({
      id: v.id,
      type: v.activity_type as string,
      date: v.activity_date_time,
      notes: v.notes,
      participants: v.activity_participants || [],
      title: null as string | null,
      route: null as string | null,
    })),
    ...projects.map(p => ({
      id: p.id,
      type: 'Project',
      date: p.activity_date_time,
      notes: p.notes,
      participants: [],
      title: p.title,
      route: `/projects/${p.id}`,
    })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const latest = allItems[0];
  const daysSince = differenceInDays(new Date(), new Date(latest.date));
  const displayItems = expanded ? allItems : allItems.slice(0, 3);

  const daysSinceLabel = daysSince === 0
    ? t('contacts.careHistory.today')
    : t('contacts.careHistory.daysAgo', { count: daysSince });

  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Heart className="w-4 h-4 text-primary" />
          {t('contacts.careHistory.title')}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Summary */}
        <div className="flex flex-wrap gap-3 text-sm">
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Calendar className="w-3.5 h-3.5" />
            <span>{t('contacts.careHistory.lastInteraction', { date: format(new Date(latest.date), 'MMM d, yyyy') })}</span>
          </div>
          <Badge variant="outline" className="text-xs">
            {daysSinceLabel}
          </Badge>
        </div>

        {/* Last visit participants */}
        {latest.participants.length > 0 && (
          <div className="flex items-start gap-2 text-sm">
            <Users className="w-3.5 h-3.5 mt-0.5 text-muted-foreground flex-shrink-0" />
            <div className="flex flex-wrap gap-1">
              <span className="text-muted-foreground">{t('contacts.careHistory.seenBy')}</span>
              {latest.participants.map((p: any) => (
                <Badge key={p.id} variant="secondary" className="text-xs">
                  {p.display_name}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* History */}
        <div className="space-y-2 pt-2 border-t border-border/50">
          {displayItems.map(item => (
            <div
              key={item.id}
              className={`text-sm space-y-1 ${item.route ? 'cursor-pointer hover:bg-muted/30 rounded p-1 -m-1' : ''}`}
              onClick={item.route ? () => navigate(item.route!) : undefined}
            >
              <div className="flex items-center gap-2">
                <span className="font-medium text-foreground">
                  {format(new Date(item.date), 'MMM d')}
                </span>
                <Badge variant="outline" className="text-xs gap-1">
                  {item.type === 'Project' && <Hammer className="h-2.5 w-2.5" />}
                  {item.type}
                </Badge>
                {item.title && (
                  <span className="text-xs text-muted-foreground truncate">{item.title}</span>
                )}
              </div>
              {item.notes && (
                <p className="text-muted-foreground text-xs line-clamp-2 pl-0">
                  {item.notes}
                </p>
              )}
            </div>
          ))}
        </div>

        {allItems.length > 3 && (
          <Button
            variant="ghost"
            size="sm"
            className="w-full text-xs gap-1"
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? (
              <>{t('contacts.careHistory.showLess')} <ChevronUp className="w-3 h-3" /></>
            ) : (
              <>{t('contacts.careHistory.viewAll', { count: allItems.length })} <ChevronDown className="w-3 h-3" /></>
            )}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
