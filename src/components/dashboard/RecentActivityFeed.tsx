import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Activity, Plus, Pencil, Trash2, User } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useTranslation } from 'react-i18next';

interface ActivityEntry {
  id: string;
  user_id: string;
  action: string;
  entity_type: string;
  entity_name: string | null;
  created_at: string;
  user_name?: string;
}

export function RecentActivityFeed() {
  const { t } = useTranslation('dashboard');

  const { data: activities, isLoading } = useQuery({
    queryKey: ['recent-activity'],
    queryFn: async () => {
      const { data: logs, error } = await supabase
        .from('audit_log')
        .select('id, user_id, action, entity_type, entity_name, created_at')
        .order('created_at', { ascending: false })
        .limit(5);

      if (error) throw error;

      // Fetch user names (use public view to avoid exposing tokens)
      const userIds = [...new Set(logs.map(log => log.user_id))];
      const { data: profiles } = await supabase
        .from('profiles_public')
        .select('user_id, display_name')
        .in('user_id', userIds);

      const userNameMap = new Map(
        profiles?.map(p => [p.user_id, p.display_name]) || []
      );

      return logs.map(log => ({
        ...log,
        user_name: userNameMap.get(log.user_id) || 'Unknown User'
      })) as ActivityEntry[];
    },
    refetchInterval: 30000 // Refresh every 30 seconds
  });

  const getActionIcon = (action: string) => {
    switch (action) {
      case 'create':
        return <Plus className="w-3 h-3" />;
      case 'update':
        return <Pencil className="w-3 h-3" />;
      case 'delete':
        return <Trash2 className="w-3 h-3" />;
      default:
        return <Activity className="w-3 h-3" />;
    }
  };

  const getActionColor = (action: string) => {
    switch (action) {
      case 'create':
        return 'bg-success/10 text-success border-success/20';
      case 'update':
        return 'bg-primary/10 text-primary border-primary/20';
      case 'delete':
        return 'bg-destructive/10 text-destructive border-destructive/20';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  const formatEntityType = (type: string) => {
    return type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  return (
    <Card>
      <CardHeader className="pb-2 pt-4">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-primary" />
          <CardTitle className="text-base">{t('activity.recentActivity')}</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="p-0 pb-2">
        <ScrollArea className="h-[140px] px-4">
          {isLoading ? (
            <div className="space-y-3 py-2">
              {[1, 2, 3, 4, 5].map(i => (
                <div key={i} className="flex items-start gap-3 animate-pulse">
                  <div className="w-8 h-8 rounded-full bg-muted" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-muted rounded w-3/4" />
                    <div className="h-3 bg-muted rounded w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          ) : activities?.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
              <Activity className="w-8 h-8 mb-2 opacity-50" />
              <p className="text-sm">{t('activity.noRecentActivity')}</p>
            </div>
          ) : (
            <div className="space-y-3 py-2">
              {activities?.map((activity) => (
                <div key={activity.id} className="flex items-start gap-3 group">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                    <User className="w-4 h-4 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm truncate">
                        {activity.user_name}
                      </span>
                      <Badge
                        variant="outline"
                        className={`text-xs gap-1 ${getActionColor(activity.action)}`}
                      >
                        {getActionIcon(activity.action)}
                        {activity.action}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground truncate">
                      {formatEntityType(activity.entity_type)}
                      {activity.entity_name && (
                        <span className="font-medium text-foreground">
                          {' '}&middot; {activity.entity_name}
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {formatDistanceToNow(new Date(activity.created_at), { addSuffix: true })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
