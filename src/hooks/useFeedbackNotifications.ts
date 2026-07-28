import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface FeedbackNotification {
  id: string;
  feedback_id: string;
  user_id: string;
  message: string;
  is_read: boolean;
  created_at: string;
}

export function useFeedbackNotifications() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Fetch unread feedback notifications
  const { data: notifications = [], isLoading } = useQuery({
    queryKey: ['feedback-notifications', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('feedback_notifications')
        .select('*')
        .eq('user_id', user?.id)
        .eq('is_read', false)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as FeedbackNotification[];
    },
    enabled: !!user?.id,
  });

  // Fetch all feedback notifications (including read)
  const { data: allNotifications = [] } = useQuery({
    queryKey: ['feedback-notifications', 'all', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('feedback_notifications')
        .select('*')
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as FeedbackNotification[];
    },
    enabled: !!user?.id,
  });

  // Mark notification as read
  const markAsRead = useMutation({
    mutationFn: async (notificationId: string) => {
      const { error } = await supabase
        .from('feedback_notifications')
        .update({ is_read: true })
        .eq('id', notificationId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['feedback-notifications'] });
    },
  });

  // Mark all notifications as read
  const markAllAsRead = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('feedback_notifications')
        .update({ is_read: true })
        .eq('user_id', user?.id)
        .eq('is_read', false);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['feedback-notifications'] });
    },
  });

  return {
    notifications,
    allNotifications,
    unreadCount: notifications.length,
    isLoading,
    markAsRead,
    markAllAsRead,
  };
}
