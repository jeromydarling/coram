/**
 * OperatorNotificationsPage — Notifications inbox for Operator Nexus.
 *
 * WHAT: Shows operator notifications with filters, mark-read, and deep links.
 * WHERE: /operator/nexus/notifications
 * WHY: Calm, high-signal awareness without logging in constantly.
 *      Uses the Presence Engine for visual hierarchy and Ignatian language.
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from '@/components/ui/sonner';
import { useNavigate } from 'react-router-dom';
import {
  Bell, Check, CheckCheck, Pen, AlertTriangle, TestTube2, Shield,
  Sprout, Plug, MessageSquare, Leaf, Filter,
} from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { HelpCircle as HelpIcon } from 'lucide-react';
import { useState } from 'react';
import {
  presenceFromRow,
  presenceCardClasses,
  presenceBadgeVariant,
  applyIgnatianFilter,
  type PresenceLevel,
} from '@/lib/operator/presence';

function HelpTip({ text }: { text: string }) {
  return (
    <TooltipProvider><Tooltip><TooltipTrigger asChild>
      <HelpIcon className="h-3.5 w-3.5 text-muted-foreground inline ml-1" />
    </TooltipTrigger><TooltipContent><p className="max-w-xs text-xs">{text}</p></TooltipContent></Tooltip></TooltipProvider>
  );
}

const TYPE_CONFIG: Record<string, { icon: React.ElementType; label: string }> = {
  draft_ready: { icon: Pen, label: 'Draft Ready' },
  critical_error: { icon: AlertTriangle, label: 'Critical Error' },
  error_spike: { icon: AlertTriangle, label: 'Error Spike' },
  qa_failure: { icon: TestTube2, label: 'QA Failure' },
  security_flag: { icon: Shield, label: 'Security Flag' },
  activation_stuck: { icon: Sprout, label: 'Activation Stuck' },
  migration_failed: { icon: Plug, label: 'Migration Failed' },
  system_message: { icon: MessageSquare, label: 'System Message' },
};

export default function OperatorNotificationsPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [typeFilter, setTypeFilter] = useState<string | null>(null);

  const { data: notifications, isLoading } = useQuery({
    queryKey: ['operator-notifications', typeFilter],
    enabled: !!user?.id,
    queryFn: async () => {
      let q = supabase.from('operator_notifications')
        .select('*')
        .eq('operator_user_id', user!.id)
        .order('created_at', { ascending: false })
        .limit(100);
      if (typeFilter) q = q.eq('type', typeFilter);
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },
  });

  const markReadMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('operator_notifications')
        .update({ is_read: true })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['operator-notifications'] });
      qc.invalidateQueries({ queryKey: ['operator-unread-count'] });
    },
  });

  const markAllReadMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('operator_notifications')
        .update({ is_read: true })
        .eq('operator_user_id', user!.id)
        .eq('is_read', false);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('All notifications marked as read');
      qc.invalidateQueries({ queryKey: ['operator-notifications'] });
      qc.invalidateQueries({ queryKey: ['operator-unread-count'] });
    },
  });

  const unreadCount = notifications?.filter((n: any) => !n.is_read).length || 0;

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Bell className="w-5 h-5 text-primary" />
            <h1 className="text-xl font-semibold text-foreground font-serif">Notifications</h1>
            <HelpTip text="Calm, high-signal garden signals from the ecosystem. No panic — just awareness of what needs presence." />
          </div>
          <p className="text-sm text-muted-foreground">
            {unreadCount > 0 ? `${unreadCount} unread` : 'All caught up'}
          </p>
        </div>
        {unreadCount > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => markAllReadMutation.mutate()}
            disabled={markAllReadMutation.isPending}
          >
            <CheckCheck className="w-4 h-4 mr-1" />
            Mark all read
          </Button>
        )}
      </div>

      {/* Type filter chips */}
      <div className="flex items-center gap-2 flex-wrap">
        <Filter className="w-3.5 h-3.5 text-muted-foreground" />
        <Button
          variant={typeFilter === null ? 'default' : 'outline'}
          size="sm"
          className="text-xs h-7"
          onClick={() => setTypeFilter(null)}
        >
          All
        </Button>
        {Object.entries(TYPE_CONFIG).map(([key, cfg]) => (
          <Button
            key={key}
            variant={typeFilter === key ? 'default' : 'outline'}
            size="sm"
            className="text-xs h-7"
            onClick={() => setTypeFilter(typeFilter === key ? null : key)}
          >
            {cfg.label}
          </Button>
        ))}
      </div>

      {/* Notifications List */}
      {isLoading ? (
        <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-20" />)}</div>
      ) : !notifications?.length ? (
        <Card>
          <CardContent className="py-12 flex flex-col items-center gap-3 text-muted-foreground">
            <Leaf className="w-6 h-6 text-primary" />
            <p className="text-sm font-serif italic">
              {typeFilter ? 'No notifications of this type.' : 'No notifications yet. The system is quiet.'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {notifications.map((n: any) => {
            const cfg = TYPE_CONFIG[n.type] || TYPE_CONFIG.system_message;
            const Icon = cfg.icon;
            const presence = presenceFromRow(n);
            const cardPresence = !n.is_read ? presenceCardClasses(presence.level) : 'border-border/50';
            return (
              <Card
                key={n.id}
                className={`transition-colors cursor-pointer ${cardPresence} ${!n.is_read ? 'bg-primary/5' : ''}`}
                onClick={() => {
                  if (!n.is_read) markReadMutation.mutate(n.id);
                  if (n.deep_link) navigate(n.deep_link);
                }}
              >
                <CardContent className="py-3 px-4 flex items-start gap-3">
                  <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${!n.is_read ? 'text-primary' : 'text-muted-foreground'}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-0.5">
                      <span className="text-sm font-medium text-foreground">
                        {applyIgnatianFilter(n.title)}
                      </span>
                      <Badge variant={presenceBadgeVariant(presence.level)} className="text-xs">
                        {presence.level}
                      </Badge>
                      {!n.is_read && <span className="w-2 h-2 rounded-full bg-primary shrink-0" />}
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {applyIgnatianFilter(n.body)}
                    </p>
                    <p className="text-xs text-muted-foreground/60 mt-1">
                      {new Date(n.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                    </p>
                  </div>
                  {!n.is_read && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="shrink-0"
                      onClick={(e) => {
                        e.stopPropagation();
                        markReadMutation.mutate(n.id);
                      }}
                    >
                      <Check className="w-3.5 h-3.5" />
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
