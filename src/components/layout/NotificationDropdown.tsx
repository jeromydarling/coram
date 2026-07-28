import { Bell, AlertTriangle, CheckCircle2, Clock, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useNotifications, Notification } from '@/hooks/useNotifications';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { parseISO, formatDistanceToNow } from 'date-fns';

export function NotificationDropdown() {
  const { data: notifications = [], isLoading } = useNotifications();
  const navigate = useNavigate();

  const overdueCount = notifications.filter(n => n.type === 'overdue_action' && n.severity === 'warning').length;
  const hasNotifications = notifications.length > 0;

  const handleNotificationClick = (notification: Notification) => {
    switch (notification.entityType) {
      case 'opportunity':
        navigate(`/opportunities/${notification.entityId}`);
        break;
      case 'pipeline':
        navigate(`/pipeline?selected=${notification.entityId}`);
        break;
      case 'contact_task':
        // entityId is the contact_id for tasks
        navigate(`/people/${notification.entityId}`);
        break;
    }
  };

  const getIcon = (notification: Notification) => {
    if (notification.type === 'pipeline_milestone') {
      return <CheckCircle2 className="w-4 h-4 text-success flex-shrink-0" />;
    }
    if (notification.severity === 'warning') {
      return <AlertTriangle className="w-4 h-4 text-destructive flex-shrink-0" />;
    }
    return <Clock className="w-4 h-4 text-warning flex-shrink-0" />;
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="w-5 h-5" />
          {overdueCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 bg-destructive rounded-full text-[10px] font-medium text-destructive-foreground flex items-center justify-center">
              {overdueCount > 9 ? '9+' : overdueCount}
            </span>
          )}
          {overdueCount === 0 && hasNotifications && (
            <span className="absolute top-1 right-1 w-2 h-2 bg-success rounded-full" />
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel className="flex items-center justify-between">
          <span>Notifications</span>
          {overdueCount > 0 && (
            <span className="text-xs font-normal text-destructive">
              {overdueCount} overdue
            </span>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        
        <ScrollArea className="h-[300px]">
          {isLoading ? (
            <div className="p-4 text-center text-sm text-muted-foreground">
              Loading...
            </div>
          ) : notifications.length === 0 ? (
            <div className="p-4 text-center text-sm text-muted-foreground">
              <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-success/50" />
              All caught up!
            </div>
          ) : (
            <div className="py-1">
              {notifications.slice(0, 15).map((notification) => (
                <DropdownMenuItem
                  key={notification.id}
                  className={cn(
                    'flex items-start gap-3 p-3 cursor-pointer',
                    notification.severity === 'warning' && 'bg-destructive/5'
                  )}
                  onClick={() => handleNotificationClick(notification)}
                >
                  {getIcon(notification)}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{notification.title}</p>
                    <p className={cn(
                      'text-xs',
                      notification.severity === 'warning' ? 'text-destructive' : 
                      notification.severity === 'success' ? 'text-success' : 
                      'text-muted-foreground'
                    )}>
                      {notification.subtitle}
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      {formatDistanceToNow(parseISO(notification.timestamp), { addSuffix: true })}
                    </p>
                  </div>
                  <ExternalLink className="w-3 h-3 text-muted-foreground flex-shrink-0 mt-0.5" />
                </DropdownMenuItem>
              ))}
            </div>
          )}
        </ScrollArea>

        {notifications.length > 15 && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem 
              className="text-center text-sm text-primary cursor-pointer justify-center"
              onClick={() => navigate('/opportunities')}
            >
              View all ({notifications.length})
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
