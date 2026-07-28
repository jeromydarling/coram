import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { differenceInDays, parseISO, isToday, isPast, startOfDay } from 'date-fns';

export interface Notification {
  id: string;
  type: 'overdue_action' | 'pipeline_milestone';
  title: string;
  subtitle: string;
  timestamp: string;
  entityType: 'opportunity' | 'pipeline' | 'contact_task';
  entityId: string;
  severity: 'warning' | 'success' | 'info';
}

export function useNotifications() {
  return useQuery({
    queryKey: ['notifications'],
    queryFn: async () => {
      const notifications: Notification[] = [];

      // 1. Fetch overdue opportunity actions
      const { data: opportunities } = await supabase
        .from('opportunities')
        .select('id, organization, next_step, next_action_due')
        .not('next_action_due', 'is', null)
        .eq('status', 'Active')
        .order('next_action_due', { ascending: true });

      if (opportunities) {
        const now = startOfDay(new Date());
        for (const opp of opportunities) {
          if (opp.next_action_due) {
            const dueDate = parseISO(opp.next_action_due);
            if (isPast(dueDate) || isToday(dueDate)) {
              const daysOverdue = differenceInDays(now, startOfDay(dueDate));
              notifications.push({
                id: `opp-${opp.id}`,
                type: 'overdue_action',
                title: opp.organization,
                subtitle: daysOverdue > 0 
                  ? `Action overdue by ${daysOverdue} day${daysOverdue !== 1 ? 's' : ''}`
                  : 'Action due today',
                timestamp: opp.next_action_due,
                entityType: 'opportunity',
                entityId: opp.id,
                severity: daysOverdue > 0 ? 'warning' : 'info',
              });
            }
          }
        }
      }

      // 2. Fetch overdue pipeline actions
      const { data: pipelines } = await supabase
        .from('anchor_pipeline')
        .select(`
          id,
          next_action,
          next_action_due,
          opportunities (organization)
        `)
        .not('next_action_due', 'is', null)
        .order('next_action_due', { ascending: true });

      if (pipelines) {
        const now = startOfDay(new Date());
        for (const pl of pipelines) {
          if (pl.next_action_due) {
            const dueDate = parseISO(pl.next_action_due);
            if (isPast(dueDate) || isToday(dueDate)) {
              const daysOverdue = differenceInDays(now, startOfDay(dueDate));
              notifications.push({
                id: `pl-${pl.id}`,
                type: 'overdue_action',
                title: (pl.opportunities as any)?.organization || 'Pipeline Item',
                subtitle: daysOverdue > 0 
                  ? `Pipeline action overdue by ${daysOverdue} day${daysOverdue !== 1 ? 's' : ''}`
                  : 'Pipeline action due today',
                timestamp: pl.next_action_due,
                entityType: 'pipeline',
                entityId: pl.id,
                severity: daysOverdue > 0 ? 'warning' : 'info',
              });
            }
          }
        }
      }

      // 3. Fetch overdue contact tasks
      const { data: tasks } = await supabase
        .from('contact_tasks')
        .select(`
          id,
          title,
          due_date,
          contact_id,
          contacts (name)
        `)
        .eq('is_completed', false)
        .not('due_date', 'is', null)
        .order('due_date', { ascending: true });

      if (tasks) {
        const now = startOfDay(new Date());
        for (const task of tasks) {
          if (task.due_date) {
            const dueDate = parseISO(task.due_date);
            if (isPast(dueDate) || isToday(dueDate)) {
              const daysOverdue = differenceInDays(now, startOfDay(dueDate));
              notifications.push({
                id: `task-${task.id}`,
                type: 'overdue_action',
                title: task.title,
                subtitle: daysOverdue > 0 
                  ? `Task overdue by ${daysOverdue} day${daysOverdue !== 1 ? 's' : ''}`
                  : 'Task due today',
                timestamp: task.due_date,
                entityType: 'contact_task',
                entityId: task.contact_id, // Use contact_id for deep-linking
                severity: daysOverdue > 0 ? 'warning' : 'info',
              });
            }
          }
        }
      }

      // 4. Fetch recent pipeline milestones (last 7 days)
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const { data: anchors } = await supabase
        .from('anchors')
        .select(`
          id,
          anchor_id,
          agreement_signed_date,
          first_volume_date,
          opportunities (organization)
        `)
        .or(`agreement_signed_date.gte.${sevenDaysAgo.toISOString().split('T')[0]},first_volume_date.gte.${sevenDaysAgo.toISOString().split('T')[0]}`)
        .order('created_at', { ascending: false })
        .limit(10);

      if (anchors) {
        for (const anchor of anchors) {
          const orgName = (anchor.opportunities as any)?.organization || anchor.anchor_id;
          
          if (anchor.first_volume_date && parseISO(anchor.first_volume_date) >= sevenDaysAgo) {
            notifications.push({
              id: `anchor-fv-${anchor.id}`,
              type: 'pipeline_milestone',
              title: orgName,
              subtitle: '🎉 First Volume achieved!',
              timestamp: anchor.first_volume_date,
              entityType: 'opportunity',
              entityId: anchor.id,
              severity: 'success',
            });
          } else if (anchor.agreement_signed_date && parseISO(anchor.agreement_signed_date) >= sevenDaysAgo) {
            notifications.push({
              id: `anchor-as-${anchor.id}`,
              type: 'pipeline_milestone',
              title: orgName,
              subtitle: '✅ Agreement Signed',
              timestamp: anchor.agreement_signed_date,
              entityType: 'opportunity',
              entityId: anchor.id,
              severity: 'success',
            });
          }
        }
      }

      // Sort: overdue actions first (by severity), then milestones
      return notifications.sort((a, b) => {
        if (a.type === 'overdue_action' && b.type !== 'overdue_action') return -1;
        if (a.type !== 'overdue_action' && b.type === 'overdue_action') return 1;
        if (a.severity === 'warning' && b.severity !== 'warning') return -1;
        if (a.severity !== 'warning' && b.severity === 'warning') return 1;
        return new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
      });
    },
    refetchInterval: 5 * 60 * 1000, // Refetch every 5 minutes
  });
}
