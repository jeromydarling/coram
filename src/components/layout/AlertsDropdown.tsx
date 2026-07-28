import { Bell, CheckCircle2, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useUserAlerts, useUnreadAlertCount, useMarkAlertRead, useMarkAllAlertsRead, type UserAlert } from '@/hooks/useUserAlerts';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { formatDistanceToNow, parseISO } from 'date-fns';

function alertRoute(alert: UserAlert): string | null {
  if (alert.ref_type === 'org_next_action' || alert.ref_type === 'opportunity') {
    return `/opportunities/${alert.ref_id}`;
  }
  if (alert.ref_type === 'campaign') {
    return `/campaigns`;
  }
  // contact_task alerts need async lookup — handled in handleClick
  return null;
}

export function AlertsDropdown() {
  const { data: alerts = [] } = useUserAlerts();
  const { data: unreadCount = 0 } = useUnreadAlertCount();
  const markRead = useMarkAlertRead();
  const markAllRead = useMarkAllAlertsRead();
  const navigate = useNavigate();

  const handleClick = async (alert: UserAlert) => {
    if (!alert.read_at) {
      markRead.mutate(alert.id);
    }

    // Handle contact_task alerts — look up contact slug from task
    if (alert.ref_type === 'contact_task' && alert.ref_id) {
      const { data: task } = await supabase
        .from('contact_tasks')
        .select('contacts (slug)')
        .eq('id', alert.ref_id)
        .maybeSingle();
      
      const slug = (task?.contacts as any)?.slug;
      if (slug) {
        navigate(`/people/${slug}`);
        return;
      }
    }

    const route = alertRoute(alert);
    if (route) navigate(route);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="w-5 h-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 bg-primary rounded-full text-[10px] font-medium text-primary-foreground flex items-center justify-center">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel className="flex items-center justify-between">
          <span>Alerts</span>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="text-xs h-6 px-2"
              onClick={() => markAllRead.mutate()}
            >
              Mark all read
            </Button>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <ScrollArea className="h-[300px]">
          {alerts.length === 0 ? (
            <div className="p-4 text-center text-sm text-muted-foreground">
              <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-success/50" />
              No alerts
            </div>
          ) : (
            <div className="py-1">
              {alerts.slice(0, 20).map((alert) => (
                <DropdownMenuItem
                  key={alert.id}
                  className={cn(
                    'flex items-start gap-3 p-3 cursor-pointer',
                    !alert.read_at && 'bg-primary/5'
                  )}
                  onClick={() => handleClick(alert)}
                >
                  <div className="flex-1 min-w-0">
                    <p className={cn('text-sm truncate', !alert.read_at && 'font-medium')}>
                      {alert.message}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <Badge variant="outline" className="text-[10px]">{alert.alert_type}</Badge>
                      <span className="text-[10px] text-muted-foreground">
                        {formatDistanceToNow(parseISO(alert.created_at), { addSuffix: true })}
                      </span>
                    </div>
                  </div>
                  {(alertRoute(alert) || alert.ref_type === 'contact_task') && <ExternalLink className="w-3 h-3 text-muted-foreground shrink-0 mt-0.5" />}
                </DropdownMenuItem>
              ))}
            </div>
          )}
        </ScrollArea>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
