import { useState, useEffect, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams, useNavigate, Link, useLocation } from 'react-router-dom';
import { useTenantPath } from '@/hooks/useTenantPath';
import { parseISO } from 'date-fns';
import { MainLayout } from '@/components/layout/MainLayout';
import { useEvents, useDuplicateEvent, useUpdateEvent } from '@/hooks/useEvents';
import { useContactsByEvent, useEventContactsCount } from '@/hooks/useEventContactsCount';
import { SuggestedContactsPanel } from '@/components/contact-suggestions/SuggestedContactsPanel';
import { EventVolunteerHours } from '@/components/events/EventVolunteerHours';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  ArrowLeft,
  Calendar, 
  MapPin,
  Users, 
  CheckCircle2, 
  XCircle,
  Copy,
  Pencil,
  Building2,
  ExternalLink,
  Target,
  Compass,
  Flag,
  Car,
  Link as LinkIcon,
  UserPlus,
  TrendingUp,
  Loader2,
  ClipboardList,
  Sparkles
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { NoteHistoryPanel } from '@/components/notes/NoteHistoryPanel';
import { EventModal } from '@/components/modals/EventModal';
import { AttendeeMatchingPanel } from '@/components/event-planner/AttendeeMatchingPanel';
import { AttendeeTargetsList } from '@/components/event-planner/AttendeeTargetsList';
import { ConferencePlanPanel } from '@/components/event-planner/ConferencePlanPanel';
import { QuickAddAttendeeDrawer } from '@/components/event-planner/QuickAddAttendeeDrawer';
import { useEventAttendees } from '@/hooks/useEventAttendees';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/components/ui/sonner';
import { EventSlugShare } from '@/components/events/EventSlugShare';

type GrantNarrativeValue = 'High' | 'Medium' | 'Low';

export default function EventDetail() {
  const { t } = useTranslation('events');
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const isOperatorRoute = pathname.startsWith('/operator');
  const { tenantPath } = useTenantPath();
  const { data: events, isLoading } = useEvents({ mineOnly: isOperatorRoute, allTenants: isOperatorRoute });
  const event = events?.find(e => e.slug === slug || e.id === slug);
  
  const { data: contactsMade } = useContactsByEvent(event?.id || null);
  const { data: contactStats } = useEventContactsCount();
  const { data: attendees } = useEventAttendees(event?.id || null);
  const updateEvent = useUpdateEvent();
  const duplicateEvent = useDuplicateEvent();
  
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);
  const [attended, setAttended] = useState(event?.attended || false);
  const [isEnriching, setIsEnriching] = useState(false);

  const handleEnrichFromDetail = useCallback(async () => {
    if (!event?.url || !event?.id) return;
    setIsEnriching(true);
    try {
      const { data, error } = await supabase.functions.invoke('event-enrich-from-url', {
        body: { url: event.url.trim() },
      });
      if (error || !data?.ok) {
        toast.error(data?.error || error?.message || 'Enrichment failed');
        return;
      }
      const ex = data.extracted;
      const updates: Record<string, unknown> = {};
      if (ex.description && !event.notes) updates.notes = ex.description;
      if (ex.event_type && !event.event_type) updates.event_type = ex.event_type;
      if (ex.city && !event.city) updates.city = ex.city;
      if (ex.host_organization && !(event as any).host_organization) updates.host_organization = ex.host_organization;
      if (ex.is_conference != null) updates.is_conference = !!ex.is_conference;
      if (ex.target_populations?.length) updates.target_populations = ex.target_populations;

      const extras: string[] = [];
      if (ex.cost) extras.push(`Cost: ${ex.cost}`);
      if (ex.expected_attendance) extras.push(`Expected attendance: ${ex.expected_attendance}`);
      if (ex.speakers?.length) extras.push(`Speakers: ${ex.speakers.join(', ')}`);
      if (ex.topics?.length) extras.push(`Topics: ${ex.topics.join(', ')}`);
      if (ex.contact_email) extras.push(`Contact: ${ex.contact_email}`);
      if (ex.host_description) extras.push(`Host: ${ex.host_description}`);

      if (extras.length > 0) {
        const enrichedNotes = `--- Enriched from URL ---\n${extras.join('\n')}`;
        updates.notes = event.notes ? `${event.notes}\n\n${enrichedNotes}` : enrichedNotes;
      }

      if (Object.keys(updates).length > 0) {
        await updateEvent.mutateAsync({ id: event.id, ...updates });
        const count = Object.keys(updates).length;
        toast.success(t('detail.enrichSuccessCount', { count }));
      } else {
        toast.info(t('detail.enrichNoNewFields'));
      }
    } catch (err) {
      console.error('Event enrichment error:', err);
      toast.error(t('detail.enrichFailed'));
    } finally {
      setIsEnriching(false);
    }
  }, [event, updateEvent]);
  
  useEffect(() => {
    setAttended(event?.attended || false);
  }, [event?.attended]);
  
  const eventStats = event?.id ? contactStats?.[event.id] : null;
  const attendeeCount = attendees?.length || 0;
  const isConference = (event as any)?.is_conference === true;

  const handleAttendedChange = async (checked: boolean) => {
    if (!event) return;
    setAttended(checked);
    await updateEvent.mutateAsync({
      id: event.id,
      attended: checked,
    });
  };

  const handleDuplicate = async () => {
    if (!event) return;
    
    const originalDate = new Date(event.event_date);
    const nextYearDate = new Date(originalDate);
    nextYearDate.setFullYear(nextYearDate.getFullYear() + 1);
    
    await duplicateEvent.mutateAsync({
      event_name: `${event.event_name} ${t('detail.copyLabel')}`,
      event_date: nextYearDate.toISOString().split('T')[0],
      metro_id: event.metro_id,
      event_type: event.event_type,
      staff_deployed: event.staff_deployed,
      grant_narrative_value: event.grant_narrative_value,
      notes: event.notes
    });
  };

  const getTypeBadge = (type: string | null) => {
    if (!type) return 'bg-muted text-muted-foreground';
    return 'bg-primary/15 text-primary';
  };

  const getPriorityBadge = (priority: string) => {
    const styles: Record<string, string> = {
      'High': 'bg-destructive/15 text-destructive',
      'Medium': 'bg-warning/15 text-warning',
      'Low': 'bg-muted text-muted-foreground'
    };
    return styles[priority] || 'bg-muted text-muted-foreground';
  };

  const ensureExternalUrl = (url: string) => {
    if (!url) return url;
    if (url.startsWith('http://') || url.startsWith('https://')) return url;
    return `https://${url}`;
  };

  const generateMapsLink = (address: string) => {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
  };

  const LoadingWrapper = isOperatorRoute ? ({ children }: { children: React.ReactNode }) => <>{children}</> : ({ children }: { children: React.ReactNode }) => <MainLayout title="Event" subtitle="Loading...">{children}</MainLayout>;
  const NotFoundWrapper = isOperatorRoute ? ({ children }: { children: React.ReactNode }) => <>{children}</> : ({ children }: { children: React.ReactNode }) => <MainLayout title="Event Not Found" subtitle="This event does not exist">{children}</MainLayout>;

  if (isLoading) {
    return (
      <LoadingWrapper>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </LoadingWrapper>
    );
  }

  if (!event) {
    return (
      <NotFoundWrapper>
        <div className="text-center py-12">
          <p className="text-muted-foreground mb-4">{t('detail.notFound')}</p>
          <Button onClick={() => navigate(isOperatorRoute ? '/operator/events' : tenantPath('/events'))}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            {t('detail.backToEvents')}
          </Button>
        </div>
      </NotFoundWrapper>
    );
  }

  const innerContent = (
    <>
      <div className="space-y-6">
        {/* Back Button & Actions */}
        <div className="flex flex-col sm:flex-row justify-between gap-4">
          <Button variant="ghost" onClick={() => navigate(isOperatorRoute ? '/operator/events' : tenantPath('/events'))} className="gap-2 self-start">
            <ArrowLeft className="w-4 h-4" />
            {t('detail.backToEvents')}
          </Button>
          <div className="flex gap-2 flex-wrap">
            {isConference && (
              <Button className="gap-2" onClick={() => setIsQuickAddOpen(true)} data-tour="quick-add-attendee">
                <UserPlus className="w-4 h-4" />
                {t('detail.addAttendee')}
              </Button>
            )}
            <Button variant="outline" className="gap-2" onClick={handleDuplicate} disabled={duplicateEvent.isPending}>
              <Copy className="w-4 h-4" />
              {t('detail.duplicate')}
            </Button>
            <Button variant="outline" className="gap-2" onClick={() => setIsEditModalOpen(true)}>
              <Pencil className="w-4 h-4" />
              {t('detail.editEvent')}
            </Button>
          </div>
        </div>

        {/* Event Title & Date */}
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground">{event.event_name}</h1>
          <p className="text-muted-foreground mt-1 flex items-center gap-2">
            <Calendar className="w-4 h-4" />
            {parseISO(event.event_date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>

        {/* Public Registration Link */}
        <EventSlugShare
          eventId={event.id}
          eventName={event.event_name}
          currentSlug={event.slug}
        />

        {/* Attended Banner */}
        <div 
          className={cn(
            "flex items-center gap-3 p-4 rounded-lg border-2 cursor-pointer transition-colors",
            attended 
              ? "bg-success/10 border-success/50" 
              : "bg-destructive/10 border-destructive/50 hover:bg-destructive/15"
          )}
          onClick={() => handleAttendedChange(!attended)}
          data-tour="attended-toggle"
        >
          <Checkbox 
            checked={attended}
            onCheckedChange={handleAttendedChange}
            className={cn(
              "h-6 w-6",
              attended 
                ? "border-success data-[state=checked]:bg-success data-[state=checked]:text-success-foreground"
                : "border-destructive"
            )}
          />
          <span className={cn(
            "font-semibold text-lg",
            attended ? "text-success" : "text-destructive"
          )}>
            {attended ? t('detail.attended') : t('detail.notAttended')}
          </span>
        </div>

        {/* Event Header Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex flex-wrap items-center gap-2">
              {event.event_type && (
                <Badge className={cn('font-medium', getTypeBadge(event.event_type))}>
                  {event.event_type}
                </Badge>
              )}
              {event.priority && (
                <Badge className={cn('font-medium', getPriorityBadge(event.priority))}>
                  {t('detail.priority', { level: event.priority })}
                </Badge>
              )}
              {isConference && event.status && (
                <Badge variant="outline">
                  {event.status}
                </Badge>
              )}
              {isConference && (
                <Badge className="bg-primary/10 text-primary gap-1" data-tour="conference-mode-toggle">
                  <ClipboardList className="w-3 h-3" />
                  {t('detail.conferenceMode')}
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Location & Links */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <LinkIcon className="w-4 h-4 text-muted-foreground" />
                {event.url ? (
                  <>
                    <a
                      href={ensureExternalUrl(event.url)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline inline-flex items-center gap-1"
                    >
                      {t('detail.eventPage')}
                      <ExternalLink className="w-3 h-3" />
                    </a>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2 text-xs gap-1 text-muted-foreground hover:text-primary"
                      onClick={handleEnrichFromDetail}
                      disabled={isEnriching}
                      title={t('detail.enrichTooltip')}
                    >
                      {isEnriching ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                      {isEnriching ? t('detail.enriching') : t('detail.enrich')}
                    </Button>
                  </>
                ) : (
                  <span className="text-muted-foreground italic">{t('detail.noLink')}</span>
                )}
              </div>
              <div className="flex items-center gap-2 text-sm">
                <MapPin className="w-4 h-4 text-muted-foreground" />
                <span className="text-foreground">{event.metros?.metro || t('detail.noMetro')}</span>
              </div>
              <div className="flex items-start gap-2 text-sm">
                <MapPin className="w-4 h-4 text-muted-foreground mt-0.5" />
                {event.city ? (
                  <div className="flex-1">
                    <span className="whitespace-pre-wrap">{event.city}</span>
                    <a
                      href={generateMapsLink(event.city)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline inline-flex items-center gap-1 ml-2"
                    >
                      <ExternalLink className="w-3 h-3" />
                      {t('detail.map')}
                    </a>
                  </div>
                ) : (
                  <span className="text-muted-foreground italic">{t('detail.noAddress')}</span>
                )}
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Building2 className="w-4 h-4 text-muted-foreground" />
                {event.host_opportunity_id ? (
                  <Link
                    to={tenantPath(`/partners/${event.host_opportunity_id}`)}
                    className="text-primary hover:underline flex items-center gap-1"
                  >
                    {event.host_organization || t('detail.linkedPartner')}
                    <Badge variant="outline" className="text-[10px] px-1 py-0 ml-1">Partner</Badge>
                  </Link>
                ) : (
                  <span className={event.host_organization ? '' : 'text-muted-foreground italic'}>
                    {event.host_organization || t('detail.noHostOrg')}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Car className="w-4 h-4 text-muted-foreground" />
                <span className={event.travel_required ? '' : 'text-muted-foreground italic'}>
                  {event.travel_required ? t('detail.travel', { info: event.travel_required }) : t('detail.noTravelInfo')}
                </span>
              </div>
            </div>

            {/* Description */}
            <div className="space-y-2">
              <p className="text-sm font-medium text-muted-foreground">{t('detail.description')}</p>
              <p className={cn("text-sm whitespace-pre-wrap", event.description ? "text-foreground" : "text-muted-foreground italic")}>
                {event.description || t('detail.noDescription')}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Stats Grid — Attended + Staff */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-4 text-center">
              <div className="flex items-center justify-center gap-1 mb-1">
                <Users className="w-4 h-4 text-primary" />
              </div>
              <p className="text-2xl font-bold text-foreground">{event.households_served || 0}</p>
              <p className="text-xs text-muted-foreground">{t('detail.numAttended')}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="flex items-center justify-center gap-1 mb-1">
                <Users className="w-4 h-4 text-warning" />
              </div>
              <p className="text-2xl font-bold text-foreground">{event.staff_deployed || 0}</p>
              <p className="text-xs text-muted-foreground">{t('detail.staff')}</p>
            </CardContent>
          </Card>
          {event.expected_households && (
            <Card>
              <CardContent className="p-4 text-center">
                <div className="flex items-center justify-center gap-1 mb-1">
                  <Users className="w-4 h-4 text-muted-foreground" />
                </div>
                <p className="text-2xl font-bold text-foreground/70">{event.expected_households}</p>
                <p className="text-xs text-muted-foreground">{t('detail.expectedAttendance')}</p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* People Met */}
        {contactsMade && contactsMade.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <UserPlus className="w-4 h-4 text-primary" />
                  {t('detail.peopleMet', { count: contactsMade.length })}
                </div>
                {eventStats && eventStats.count > 0 && (
                  <div className="flex items-center gap-2 text-sm font-normal">
                    <TrendingUp className="w-4 h-4 text-success" />
                    <span className="text-muted-foreground">
                      {eventStats.withOpportunity} {t('detail.converted')}
                      <span className="text-success font-medium ml-1">
                        ({eventStats.conversionRate.toFixed(0)}%)
                      </span>
                    </span>
                  </div>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {contactsMade.map((person) => (
                  <Link key={person.id} to={tenantPath(`/people/${person.slug || person.id}`)}>
                    <Badge 
                      variant={person.opportunity_id ? "default" : "secondary"} 
                      className={cn("text-xs cursor-pointer hover:opacity-80", person.opportunity_id && "bg-success/15 text-success")}
                    >
                      {person.name}
                      {person.opportunities?.organization && (
                        <span className="text-success/70 ml-1">
                          → {person.opportunities.organization}
                        </span>
                      )}
                    </Badge>
                  </Link>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Volunteer Hours */}
        {event.id && <EventVolunteerHours eventId={event.id} />}

        {/* Target Population, Strategic Lanes, Goals */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {event.target_populations && event.target_populations.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Target className="w-4 h-4 text-muted-foreground" />
                  {t('detail.targetPopulation')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-1">
                  {event.target_populations.map((pop) => (
                    <Badge key={pop} variant="secondary" className="text-xs">
                      {pop}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {event.strategic_lanes && event.strategic_lanes.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Compass className="w-4 h-4 text-muted-foreground" />
                  {t('detail.strategicLane')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-1">
                  {event.strategic_lanes.map((lane) => (
                    <Badge key={lane} variant="outline" className="text-xs">
                      {lane}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {event.pcs_goals && event.pcs_goals.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Flag className="w-4 h-4 text-muted-foreground" />
                  {t('detail.goals')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-1">
                  {event.pcs_goals.map((goal) => (
                    <Badge key={goal} variant="secondary" className="text-xs bg-primary/10 text-primary">
                      {goal}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Additional Info */}
        <Card>
          <CardContent className="p-4">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">{t('detail.staffDeployed')}</span>
                <span className="font-medium">{event.staff_deployed || 0}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">{t('detail.anchorIdentified')}</span>
                {event.anchor_identified_yn ? (
                  <CheckCircle2 className="w-5 h-5 text-success" />
                ) : (
                  <XCircle className="w-5 h-5 text-muted" />
                )}
              </div>
              {event.grant_narrative_value && (
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">{t('detail.grantNarrative')}</span>
                  <span className={cn(
                    "font-medium",
                    event.grant_narrative_value === 'High' && 'text-success',
                    event.grant_narrative_value === 'Medium' && 'text-warning',
                    event.grant_narrative_value === 'Low' && 'text-muted-foreground'
                  )}>
                    {event.grant_narrative_value}
                  </span>
                </div>
              )}
              {event.anchor_potential && (
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">{t('detail.anchorPotential')}</span>
                  <span className="font-medium">{event.anchor_potential}</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Conference Mode Tabs */}
        {isConference && (
          <Card>
            <CardContent className="pt-6">
              <Tabs defaultValue="attendees">
                <TabsList data-tour="event-tab-bar">
                  <TabsTrigger value="attendees" className="gap-2" data-tour="import-attendees">
                    <Users className="w-4 h-4" />
                    {t('detail.tabAttendees')}
                    <Badge variant="secondary">{attendeeCount}</Badge>
                  </TabsTrigger>
                  <TabsTrigger value="targets" className="gap-2">
                    <Target className="w-4 h-4" />
                    {t('detail.tabTargets')}
                  </TabsTrigger>
                  <TabsTrigger value="plan" className="gap-2" data-tour="conference-plan-tab">
                    <ClipboardList className="w-4 h-4" />
                    {t('detail.tabConferencePlan')}
                  </TabsTrigger>
                </TabsList>
                
                <TabsContent value="attendees" className="mt-4">
                  <AttendeeMatchingPanel eventId={event.id} />
                </TabsContent>
                
                <TabsContent value="targets" className="mt-4">
                  <AttendeeTargetsList eventId={event.id} />
                </TabsContent>
                
                <TabsContent value="plan" className="mt-4">
                  <ConferencePlanPanel event={event as any} />
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        )}

        {/* Suggested Contacts */}
        <SuggestedContactsPanel entityType="event" entityId={event.id} />

        {/* Note History */}
        <Card>
          <CardContent className="pt-6">
            <NoteHistoryPanel 
              entityType="event" 
              entityId={event.id} 
            />
          </CardContent>
        </Card>
      </div>

      <EventModal
        open={isEditModalOpen}
        onOpenChange={setIsEditModalOpen}
        event={event as any}
      />

      {event && isConference && (
        <QuickAddAttendeeDrawer
          open={isQuickAddOpen}
          onOpenChange={setIsQuickAddOpen}
          eventId={event.id}
        />
      )}
    </>
  );

  if (isOperatorRoute) {
    return innerContent;
  }

  return (
    <MainLayout 
      title={event.event_name} 
      subtitle={parseISO(event.event_date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
      mobileTitle={event.event_name.split(' ').slice(0, 2).join(' ')}
    >
      {innerContent}
    </MainLayout>
  );
}
