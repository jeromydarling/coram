/**
 * Visits — Simplified mobile-first page for Visitor ministry role.
 *
 * WHAT: Shows today's visits, mark-attended, add-reflection shortcuts, voice note capture.
 * WHERE: /:tenantSlug/visits — the default landing for visitors.
 * WHY: Visitors are volunteers who need a calm, paper-list experience with no CRM jargon.
 */

import { useState } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Check, MapPin, Clock, Plus, Heart, Mic, FileText, Users } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useTenant } from '@/contexts/TenantContext';
import { toast } from '@/components/ui/sonner';
import { format, startOfDay, endOfDay } from 'date-fns';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { VoiceRecorder } from '@/components/voice/VoiceRecorder';
import { OnBehalfOfRecorder } from '@/components/voice/OnBehalfOfRecorder';
import { useVoiceNotes } from '@/hooks/useVoiceNotes';
import { LivingSignalCard } from '@/components/living/LivingSignalCard';
import { VigiliaCompanionCard } from '@/components/vigilia/VigiliaCompanionCard';
import { CommunioAwarenessCard } from '@/components/communio/CommunioAwarenessCard';
import { CreateVisitDialog } from '@/components/visits/CreateVisitDialog';
import { useTranslation } from 'react-i18next';

export default function Visits() {
  const { t } = useTranslation('relationships');
  const { user } = useAuth();
  const { tenantId } = useTenant();
  const queryClient = useQueryClient();
  const [reflectionOpen, setReflectionOpen] = useState(false);
  const [reflectionText, setReflectionText] = useState('');
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [voiceOpen, setVoiceOpen] = useState(false);
  const [voiceSubject, setVoiceSubject] = useState<{ type: 'event'; id: string } | null>(null);
  const [createVisitOpen, setCreateVisitOpen] = useState(false);
  const [onBehalfOpen, setOnBehalfOpen] = useState(false);
  const [onBehalfActivityId, setOnBehalfActivityId] = useState<string | null>(null);

  const today = new Date();
  const todayStart = startOfDay(today).toISOString();
  const todayEnd = endOfDay(today).toISOString();

  // Detect QA mode via URL param
  const isQaMode = new URLSearchParams(window.location.search).has('qa');

  // Fetch today's events for the current user
  const { data: todayEvents = [], isLoading } = useQuery({
    queryKey: ['visitor-today-events', tenantId, user?.id],
    enabled: !!tenantId && !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('events')
        .select('id, event_name, event_date, location, status, attended')
        .gte('event_date', todayStart)
        .lte('event_date', todayEnd)
        .eq('tenant_id', tenantId!)
        .order('event_date', { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  // Recent voice notes
  const { data: recentNotes = [] } = useVoiceNotes({ limit: 10 });

  // Mark event attended
  const markAttended = useMutation({
    mutationFn: async (eventId: string) => {
      const { error } = await supabase
        .from('events')
        .update({ attended: true, status: 'Completed' })
        .eq('id', eventId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['visitor-today-events'] });
      toast.success(t('visits.visitMarkedComplete'));
    },
  });

  // Add reflection — save as an activity note
  const addReflection = useMutation({
    mutationFn: async ({ eventId, text }: { eventId: string; text: string }) => {
      const { error } = await supabase
        .from('activities')
        .insert({
          activity_id: `visit-note-${eventId}-${Date.now()}`,
          activity_type: 'Visit Note' as any,
          activity_date_time: new Date().toISOString(),
          notes: text,
          tenant_id: tenantId,
        });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(t('visits.reflectionAdded'));
      setReflectionOpen(false);
      setReflectionText('');
      setSelectedEventId(null);
    },
  });

  const openVoiceForEvent = (eventId: string) => {
    setVoiceSubject({ type: 'event', id: eventId });
    setVoiceOpen(true);
  };

  const pending = todayEvents.filter((e: any) => !e.attended);
  const completed = todayEvents.filter((e: any) => e.attended);

  return (
    <MainLayout title={t('visits.title')} mobileTitle={t('visits.mobileTitle')}>
      <div className="max-w-lg mx-auto space-y-6">
        {/* Greeting */}
        <div className="text-center space-y-2 pt-2">
          <p className="text-lg text-foreground" style={{ fontFamily: "'Playfair Display', serif" }}>
            {format(today, 'EEEE, MMMM d')}
          </p>
          <p className="text-sm text-muted-foreground">
            {pending.length === 0 && completed.length === 0
              ? t('visits.noVisitsScheduled')
              : t(pending.length !== 1 ? 'visits.visitsAhead_other' : 'visits.visitsAhead_one', { count: pending.length })}
          </p>
        </div>

        {/* Vigilia Companion */}
        <VigiliaCompanionCard compact />
        {/* Communio Awareness */}
        <CommunioAwarenessCard compact />

        {/* Formation encouragement */}
        <Card className="bg-primary/5 border-primary/10">
          <CardContent className="p-5 space-y-2">
            <h2 className="text-base font-semibold text-foreground" style={{ fontFamily: "'Playfair Display', serif" }}>
              {t('visits.quietPlace.heading')}
            </h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {t('visits.quietPlace.body')}
            </p>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 mt-1"
              onClick={() => { setVoiceSubject(null); setVoiceOpen(true); }}
            >
              <Mic className="h-3.5 w-3.5" /> {t('visits.quietPlace.recordVoiceNote')}
            </Button>
          </CardContent>
        </Card>

        {/* Encouragement card — only when no visits */}
        {!isLoading && todayEvents.length === 0 && recentNotes.length === 0 && (
          <Card className="bg-primary/5 border-primary/20">
            <CardContent className="p-6 text-center space-y-3">
              <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                <Heart className="h-7 w-7 text-primary/60" />
              </div>
              <h2 className="text-base font-semibold text-foreground" style={{ fontFamily: "'Playfair Display', serif" }}>
                {t('visits.welcomeCard.heading')}
              </h2>
              <p className="text-sm text-muted-foreground leading-relaxed max-w-sm mx-auto">
                {t('visits.welcomeCard.body')}
              </p>
              <div className="flex flex-col gap-2 pt-2">
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => {
                    setVoiceSubject(null);
                    setVoiceOpen(true);
                  }}
                >
                  <Mic className="h-4 w-4 mr-2" />
                  {t('visits.welcomeCard.recordThought')}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Action buttons */}
        <div className="flex gap-2" data-testid="quick-voice-note">
          <Button
            data-testid="voice-note-cta"
            size="lg"
            variant="outline"
            className="flex-1 h-14 text-base gap-2 border-primary/30 hover:bg-primary/5"
            onClick={() => {
              const firstPending = pending[0] as any;
              if (firstPending) {
                openVoiceForEvent(firstPending.id);
              } else {
                setVoiceSubject(null);
                setVoiceOpen(true);
              }
            }}
          >
            <Mic className="h-5 w-5" />
            {t('visits.voiceNote')}
          </Button>
          <Button
            size="lg"
            variant="outline"
            className="flex-1 h-14 text-base gap-2 border-primary/30 hover:bg-primary/5"
            onClick={() => setCreateVisitOpen(true)}
            data-testid="create-visit-btn"
          >
            <Plus className="h-5 w-5" />
            {t('visits.newVisit')}
          </Button>
        </div>

        {/* Record on behalf of a volunteer */}
        <Button
          size="lg"
          variant="ghost"
          className="w-full h-12 text-sm gap-2 text-muted-foreground"
          onClick={() => setOnBehalfOpen(true)}
          data-testid="on-behalf-btn"
        >
          <Users className="h-4 w-4" />
          {t('visits.recordForVolunteer')}
        </Button>

        {/* Pending visits */}
        {pending.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
              {t('visits.upcoming')}
            </h2>
            {pending.map((event: any) => (
              <Card key={event.id} className="border-l-4 border-l-primary/40" data-testid="visit-pending-card">
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <h3 className="font-medium text-foreground truncate">{event.event_name}</h3>
                      {event.location && (
                        <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                          <MapPin className="h-3.5 w-3.5 flex-shrink-0" />
                          <span className="truncate">{event.location}</span>
                        </p>
                      )}
                      {event.event_date && (
                        <p className="text-sm text-muted-foreground flex items-center gap-1 mt-0.5">
                          <Clock className="h-3.5 w-3.5 flex-shrink-0" />
                          {format(new Date(event.event_date), 'h:mm a')}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="lg"
                      className="flex-1 h-12 text-base"
                      onClick={() => markAttended.mutate(event.id)}
                      disabled={markAttended.isPending}
                      data-testid="mark-attended-btn"
                    >
                      <Check className="h-5 w-5 mr-2" />
                      {t('visits.markAttended')}
                    </Button>
                    <Button
                      size="lg"
                      variant="outline"
                      className="h-12"
                      onClick={() => openVoiceForEvent(event.id)}
                      data-testid="voice-note-event-btn"
                    >
                      <Mic className="h-5 w-5" />
                    </Button>
                    <Button
                      size="lg"
                      variant="outline"
                      className="h-12"
                      onClick={() => {
                        setSelectedEventId(event.id);
                        setReflectionOpen(true);
                      }}
                    >
                      <Plus className="h-5 w-5" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Completed visits */}
        {completed.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
              {t('visits.completed')}
            </h2>
            {completed.map((event: any) => (
              <Card key={event.id} className="opacity-75" data-testid="visit-completed-card">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <Check className="h-4 w-4 text-primary" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="font-medium text-foreground truncate">{event.event_name}</h3>
                      {event.location && (
                        <p className="text-xs text-muted-foreground truncate">{event.location}</p>
                      )}
                    </div>
                    <div className="flex gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => openVoiceForEvent(event.id)}
                      >
                        <Mic className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setSelectedEventId(event.id);
                          setReflectionOpen(true);
                        }}
                      >
                        <Heart className="h-4 w-4 mr-1" />
                        {t('visits.note')}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Living Signal */}
        <LivingSignalCard />

        {/* Recent voice notes */}
        {recentNotes.length > 0 && (
          <div className="space-y-3" data-testid="recent-voice-notes">
            <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
              {t('visits.recentNotes')}
            </h2>
            {recentNotes.map((note: any) => (
              <Card key={note.id} className="bg-muted/30">
                <CardContent className="p-3">
                  <div className="flex items-start gap-2">
                    <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-foreground line-clamp-2">
                        {note.transcript || t('visits.transcribing')}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {format(new Date(note.recorded_at), 'MMM d, h:mm a')}
                        {note.transcript_status === 'processing' && (
                          <Badge variant="outline" className="ml-2 text-xs">{t('visits.processing')}</Badge>
                        )}
                        {note.transcript_status === 'failed' && (
                          <Badge variant="destructive" className="ml-2 text-xs">{t('visits.failed')}</Badge>
                        )}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Loading */}
        {isLoading && (
          <div className="text-center py-12 text-muted-foreground text-sm">
            {t('visits.loading')}
          </div>
        )}
      </div>

      {/* Voice recorder dialog */}
      <Dialog open={voiceOpen} onOpenChange={(open) => {
        if (!open) {
          setVoiceOpen(false);
          setVoiceSubject(null);
        }
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle style={{ fontFamily: "'Playfair Display', serif" }}>
              {t('visits.voiceDialog.title')}
            </DialogTitle>
            <DialogDescription>
              {t('visits.voiceDialog.description')}
            </DialogDescription>
          </DialogHeader>
          {voiceSubject ? (
            <VoiceRecorder
              subjectType={voiceSubject.type}
              subjectId={voiceSubject.id}
              qaMode={isQaMode}
              onTranscriptSaved={() => {
                queryClient.invalidateQueries({ queryKey: ['voice-notes'] });
                setVoiceOpen(false);
              }}
            />
          ) : tenantId ? (
            // Generic voice note not tied to a specific event
            <VoiceRecorder
              subjectType="event"
              subjectId={tenantId} // Use tenant as a fallback subject
              qaMode={isQaMode}
              onTranscriptSaved={() => {
                queryClient.invalidateQueries({ queryKey: ['voice-notes'] });
                setVoiceOpen(false);
              }}
            />
          ) : null}
        </DialogContent>
      </Dialog>

      {/* Reflection dialog */}
      <Dialog open={reflectionOpen} onOpenChange={(open) => {
        if (!open) {
          setReflectionOpen(false);
          setReflectionText('');
          setSelectedEventId(null);
        }
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle style={{ fontFamily: "'Playfair Display', serif" }}>
              {t('visits.reflectionDialog.title')}
            </DialogTitle>
            <DialogDescription>
              {t('visits.reflectionDialog.description')}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <Textarea
              value={reflectionText}
              onChange={(e) => setReflectionText(e.target.value)}
              placeholder={t('visits.reflectionDialog.placeholder')}
              rows={4}
              className="text-base"
            />
            <Button
              className="w-full h-12 text-base"
              disabled={!reflectionText.trim() || addReflection.isPending}
              onClick={() => {
                if (selectedEventId && reflectionText.trim()) {
                  addReflection.mutate({ eventId: selectedEventId, text: reflectionText.trim() });
                }
              }}
            >
              {t('visits.reflectionDialog.saveReflection')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Create Visit dialog */}
      <CreateVisitDialog open={createVisitOpen} onOpenChange={setCreateVisitOpen} />

      {/* On-behalf-of dialog */}
      <Dialog open={onBehalfOpen} onOpenChange={(o) => {
        if (!o) { setOnBehalfOpen(false); setOnBehalfActivityId(null); }
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle style={{ fontFamily: "'Playfair Display', serif" }}>
              {t('visits.onBehalfDialog.title')}
            </DialogTitle>
            <DialogDescription>
              {t('visits.onBehalfDialog.description')}
            </DialogDescription>
          </DialogHeader>
          {onBehalfActivityId ? (
            <OnBehalfOfRecorder
              activityId={onBehalfActivityId}
              onDone={() => {
                setOnBehalfOpen(false);
                setOnBehalfActivityId(null);
                queryClient.invalidateQueries({ queryKey: ['voice-notes'] });
              }}
            />
          ) : (
            <VisitPickerForOnBehalf
              tenantId={tenantId}
              onSelect={(activityId) => setOnBehalfActivityId(activityId)}
            />
          )}
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}

/** Small inline component to pick which visit the volunteer is recording for */
function VisitPickerForOnBehalf({ tenantId, onSelect }: { tenantId: string | null; onSelect: (id: string) => void }) {
  const { t } = useTranslation('relationships');
  const today = new Date();
  const { data: visits = [], isLoading } = useQuery({
    queryKey: ['today-visit-activities', tenantId],
    enabled: !!tenantId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('activities')
        .select('id, activity_type, activity_date_time, notes, subject_contact_id')
        .eq('tenant_id', tenantId!)
        .eq('activity_type', 'Visit' as any)
        .gte('activity_date_time', startOfDay(today).toISOString())
        .lte('activity_date_time', endOfDay(today).toISOString())
        .order('activity_date_time', { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  if (isLoading) return <p className="text-sm text-muted-foreground text-center py-4">{t('visits.visitPicker.loading')}</p>;

  if (visits.length === 0) {
    return (
      <div className="text-center py-6 space-y-2">
        <p className="text-sm text-muted-foreground">{t('visits.visitPicker.noVisitsToday')}</p>
        <p className="text-xs text-muted-foreground">{t('visits.visitPicker.createFirst')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-sm text-muted-foreground">{t('visits.visitPicker.whichVisit')}</p>
      {visits.map((v: any) => (
        <Button
          key={v.id}
          variant="outline"
          className="w-full justify-start h-12 text-base"
          onClick={() => onSelect(v.id)}
        >
          {v.notes || t('visits.visitPicker.visitAt', { time: format(new Date(v.activity_date_time), 'h:mm a') })}
        </Button>
      ))}
    </div>
  );
}
