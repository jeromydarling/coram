import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { MainLayout } from '@/components/layout/MainLayout';
import { CalendarMonthView } from '@/components/calendar/CalendarMonthView';
import { CalendarWeekView } from '@/components/calendar/CalendarWeekView';
import { MeetingModal } from '@/components/calendar/MeetingModal';
import { GoogleCalendarSync } from '@/components/calendar/GoogleCalendarSync';
import { useCalendarData, CalendarEvent } from '@/hooks/useCalendarData';
import { useIsMobile } from '@/hooks/use-mobile';
import { Button } from '@/components/ui/button';
import { Plus, Loader2 } from 'lucide-react';
import { toast } from '@/components/ui/sonner';
import { supabase } from '@/integrations/supabase/client';
import { useSearchParams, useNavigate } from 'react-router-dom';

export default function CalendarPage() {
  const { t } = useTranslation('calendar');
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | undefined>();
  const [selectedDay, setSelectedDay] = useState<Date | null>(new Date());
  const [isMeetingModalOpen, setIsMeetingModalOpen] = useState(false);
  const [editingMeeting, setEditingMeeting] = useState<{
    id: string;
    activity_date_time: string;
    contact_id?: string | null;
    metro_id?: string | null;
    notes?: string | null;
    next_action?: string | null;
    attended?: boolean | null;
  } | undefined>();
  const [isGoogleConnected, setIsGoogleConnected] = useState(false);
  const isMobile = useIsMobile();
  const [lastSyncedAt, setLastSyncedAt] = useState<string | undefined>();
  
  const { data: events, isLoading, refetch } = useCalendarData(currentDate);
  
  // Check Google connection status on mount and after OAuth callback
  useEffect(() => {
    const checkGoogleConnection = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('google_calendar_enabled, gmail_last_sync_at')
          .eq('user_id', user.id)
          .single();
        
        if (profile) {
          setIsGoogleConnected(profile.google_calendar_enabled || false);
          // "Last synced" reflects when the calendar sync function last ran,
          // not when an outbound CRM activity was last pushed to Google.
          if (profile.gmail_last_sync_at) {
            setLastSyncedAt(profile.gmail_last_sync_at);
          }
        }
      }
    };
    
    checkGoogleConnection();
    
    // Check for OAuth callback success
    if (searchParams.get('google') === 'connected') {
      toast.success(t('toasts.googleConnected'));
      checkGoogleConnection();
    }
  }, []);

  // Handle deep-link for activity/event detail — redirect to full page
  useEffect(() => {
    const eventId = searchParams.get('event');
    if (eventId) {
      searchParams.delete('event');
      setSearchParams(searchParams, { replace: true });
      navigate(`/calendar/event/${eventId}`, { replace: true });
    }
  }, [searchParams, setSearchParams, navigate]);
  
  const handleDateClick = (date: Date) => {
    setSelectedDate(date);
    setIsMeetingModalOpen(true);
  };
  
  const handleEventClick = async (event: CalendarEvent) => {
    // Navigate to full page for external Google events
    if (event.type === 'external') {
      navigate(`/calendar/event/${event.id}`);
    } else if (event.type === 'event') {
      // Navigate to the event detail page (relative path preserves tenant slug)
      navigate(`events/${event.id}`);
    } else if (event.type === 'meeting') {
      // Load the existing activity data for editing
      try {
        const { data: activity } = await supabase
          .from('activities')
          .select('id, activity_date_time, contact_id, metro_id, notes, next_action, attended')
          .eq('id', event.id)
          .single();

        if (activity) {
          setEditingMeeting(activity);
        }
      } catch {
        // Fallback: open with just the date
        setEditingMeeting(undefined);
      }
      setSelectedDate(event.date);
      setIsMeetingModalOpen(true);
    } else if (event.type === 'activity') {
      // Navigate to the activities list
      navigate(`activities`);
    }
  };
  
  const handleNewMeeting = () => {
    setEditingMeeting(undefined);
    setSelectedDate(new Date());
    setIsMeetingModalOpen(true);
  };

  const handleMeetingModalClose = (open: boolean) => {
    setIsMeetingModalOpen(open);
    if (!open) {
      setEditingMeeting(undefined);
    }
  };
  
  const handleGoogleConnect = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error(t('toasts.loginToConnect'));
        return;
      }
      
      const response = await supabase.functions.invoke('google-calendar-sync', {
        body: {},
        headers: {},
      });
      
      // Check if response has the action query param format
      const functionUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/google-calendar-sync?action=auth-url`;
      const authResponse = await fetch(functionUrl, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
      });
      
      const data = await authResponse.json();
      
      if (data.error) {
        toast.error(data.message || data.error);
        return;
      }

      if (data.authUrl) {
        window.location.href = data.authUrl;
      }
    } catch (error) {
      console.error('Google connect error:', error);
      toast.error(t('toasts.connectFailed'));
    }
  };
  
  const handleGoogleDisconnect = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      
      const functionUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/google-calendar-sync?action=disconnect`;
      await fetch(functionUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
      });
      
      setIsGoogleConnected(false);
      toast.success(t('toasts.disconnected'));
    } catch (error) {
      toast.error(t('toasts.disconnectFailed'));
    }
  };
  
  const handleGoogleSync = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error(t('toasts.loginToSync'));
        return;
      }
      
      console.log('Starting Google Calendar sync...');
      const functionUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/google-calendar-sync?action=sync`;
      const response = await fetch(functionUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ direction: 'both' }),
      });
      
      const data = await response.json();
      console.log('Sync response:', data);
      
      if (!response.ok || data.error) {
        console.error('Sync error:', data);
        toast.error(data.details || data.error || t('toasts.syncFailed'));
        throw new Error(data.error);
      }

      setLastSyncedAt(new Date().toISOString());
      refetch();

      const totalSynced = (data.pushed || 0) + (data.pulled || 0);
      if (totalSynced > 0) {
        const parts = [];
        if (data.pushed > 0) parts.push(`${data.pushed} pushed`);
        if (data.pulled > 0) parts.push(`${data.pulled} pulled`);
        toast.success(t('toasts.syncedItems', { items: parts.join(', ') }));
      } else if (data.errors?.length > 0) {
        toast.warning(t('toasts.syncWithErrors', { count: data.errors.length }));
        console.error('Sync errors:', data.errors);
      } else {
        toast.info(t('toasts.calendarUpToDate'));
      }
    } catch (error) {
      console.error('Sync error:', error);
      throw error;
    }
  };
  
  return (
    <MainLayout
      title={t('page.title')}
      subtitle={t('page.subtitle')}
      data-testid="calendar-root"
    >
      <div className="space-y-6">
        {/* Header Actions */}
        <div className="flex flex-col sm:flex-row gap-4 justify-between">
          <div className="flex items-center gap-3">
            {/* Legend */}
            <div className="flex items-center gap-4 text-sm flex-wrap">
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-full bg-primary" />
                <span className="text-muted-foreground">{t('legend.events')}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: 'hsl(var(--chart-2))' }} />
                <span className="text-muted-foreground">{t('legend.meetings')}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-full bg-success" />
                <span className="text-muted-foreground">{t('legend.activities')}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: 'hsl(280 60% 55%)' }} />
                <span className="text-muted-foreground">{t('legend.googleCalendar')}</span>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <GoogleCalendarSync
              isConnected={isGoogleConnected}
              onConnect={handleGoogleConnect}
              onDisconnect={handleGoogleDisconnect}
              onSync={handleGoogleSync}
              lastSyncedAt={lastSyncedAt}
            />
            <Button onClick={handleNewMeeting} className="gap-2">
              <Plus className="w-4 h-4" />
              {t('buttons.scheduleMeeting')}
            </Button>
          </div>
        </div>
        
        {isLoading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : isMobile ? (
          <CalendarWeekView
            currentDate={currentDate}
            onDateChange={setCurrentDate}
            events={events || []}
            onEventClick={handleEventClick}
            onDateClick={handleDateClick}
            selectedDay={selectedDay}
            onDaySelect={setSelectedDay}
          />
        ) : (
          <CalendarMonthView
            currentDate={currentDate}
            onDateChange={setCurrentDate}
            events={events || []}
            onEventClick={handleEventClick}
            onDateClick={handleDateClick}
          />
        )}
        
        <MeetingModal
          open={isMeetingModalOpen}
          onOpenChange={handleMeetingModalClose}
          selectedDate={selectedDate}
          existingMeeting={editingMeeting}
        />
        
      </div>
    </MainLayout>
  );
}
