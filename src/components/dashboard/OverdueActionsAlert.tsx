import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Clock, ChevronRight, Building2, GitBranch } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

interface OverdueItem {
  id: string;
  type: 'opportunity' | 'pipeline';
  name: string;
  next_action_due: string;
  next_step?: string;
  metro?: string;
  daysOverdue: number;
}

interface OverdueActionsAlertProps {
  metroId?: string | null;
}

export function OverdueActionsAlert({ metroId }: OverdueActionsAlertProps) {
  const { t } = useTranslation('dashboard');

  const { data: overdueItems } = useQuery({
    queryKey: ['overdue-actions', metroId],
    queryFn: async () => {
      const now = new Date().toISOString();
      const items: OverdueItem[] = [];

      // Fetch overdue opportunities
      let oppQuery = supabase
        .from('opportunities')
        .select('id, organization, next_action_due, next_step, metro_id, metros(metro)')
        .lt('next_action_due', now)
        .not('next_action_due', 'is', null)
        .eq('status', 'Active');

      if (metroId) {
        oppQuery = oppQuery.eq('metro_id', metroId);
      }

      const { data: opportunities } = await oppQuery;

      opportunities?.forEach(opp => {
        const dueDate = new Date(opp.next_action_due!);
        const daysOverdue = Math.floor((Date.now() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
        items.push({
          id: opp.id,
          type: 'opportunity',
          name: opp.organization,
          next_action_due: opp.next_action_due!,
          next_step: opp.next_step || undefined,
          metro: (opp.metros as { metro: string } | null)?.metro,
          daysOverdue
        });
      });

      // Fetch overdue pipeline items
      let pipelineQuery = supabase
        .from('anchor_pipeline')
        .select('id, anchor_pipeline_id, next_action_due, next_action, metro_id, opportunities(organization), metros(metro)')
        .lt('next_action_due', now)
        .not('next_action_due', 'is', null);

      if (metroId) {
        pipelineQuery = pipelineQuery.eq('metro_id', metroId);
      }

      const { data: pipeline } = await pipelineQuery;

      pipeline?.forEach(p => {
        const dueDate = new Date(p.next_action_due!);
        const daysOverdue = Math.floor((Date.now() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
        items.push({
          id: p.id,
          type: 'pipeline',
          name: (p.opportunities as { organization: string } | null)?.organization || p.anchor_pipeline_id,
          next_action_due: p.next_action_due!,
          next_step: p.next_action || undefined,
          metro: (p.metros as { metro: string } | null)?.metro,
          daysOverdue
        });
      });

      // Sort by most overdue first
      return items.sort((a, b) => b.daysOverdue - a.daysOverdue);
    }
  });

  if (!overdueItems?.length) {
    return null;
  }

  const criticalCount = overdueItems.filter(i => i.daysOverdue > 7).length;

  return (
    <Alert variant="destructive" className="border-destructive/50 bg-destructive/5">
      <AlertTriangle className="h-4 w-4" />
      <AlertTitle className="flex items-center gap-2">
        {t('cards.overdueActions')}
        <Badge variant="destructive" className="ml-2">
          {t('cards.item', { count: overdueItems.length })}
        </Badge>
        {criticalCount > 0 && (
          <Badge variant="outline" className="bg-destructive/20 text-destructive border-destructive/30">
            {t('cards.critical', { count: criticalCount })}
          </Badge>
        )}
      </AlertTitle>
      <AlertDescription>
        <div className="mt-3 space-y-2">
          {overdueItems.slice(0, 5).map((item) => (
            <div
              key={`${item.type}-${item.id}`}
              className="flex items-center justify-between p-2 rounded-lg bg-background/50 border border-border"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className={`p-1.5 rounded ${item.type === 'opportunity' ? 'bg-primary/10' : 'bg-warning/10'}`}>
                  {item.type === 'opportunity' ? (
                    <Building2 className="w-4 h-4 text-primary" />
                  ) : (
                    <GitBranch className="w-4 h-4 text-warning" />
                  )}
                </div>
                <div className="min-w-0">
                  <p className="font-medium text-sm truncate">{item.name}</p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Clock className="w-3 h-3" />
                    <span className={item.daysOverdue > 7 ? 'text-destructive font-medium' : ''}>
                      {t('cards.daysOverdue', { count: item.daysOverdue })}
                    </span>
                    {item.metro && (
                      <>
                        <span>•</span>
                        <span>{item.metro}</span>
                      </>
                    )}
                  </div>
                  {item.next_step && (
                    <p className="text-xs text-muted-foreground truncate mt-0.5">
                      {item.next_step}
                    </p>
                  )}
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                asChild
                className="shrink-0"
              >
                <Link to={item.type === 'opportunity' ? '/opportunities' : '/pipeline'}>
                  <ChevronRight className="w-4 h-4" />
                </Link>
              </Button>
            </div>
          ))}
          {overdueItems.length > 5 && (
            <p className="text-xs text-muted-foreground text-center pt-1">
              {t('cards.moreOverdueItems', { count: overdueItems.length - 5 })}
            </p>
          )}
        </div>
      </AlertDescription>
    </Alert>
  );
}
