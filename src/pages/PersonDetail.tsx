import { useState } from 'react';
import { savePendingCall } from '@/utils/pendingCallStorage';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { MainLayout } from '@/components/layout/MainLayout';
import { useContacts } from '@/hooks/useContacts';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/contexts/TenantContext';
import { useDeleteWithUndo } from '@/hooks/useDeleteWithUndo';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  ArrowLeft,
  User,
  Mail,
  Phone,
  Building2,
  Pencil,
  Star,
  Calendar,
  CalendarPlus,
  Trash2,
  Loader2,
  ShieldBan
} from 'lucide-react';
import { NoteHistoryPanel } from '@/components/notes/NoteHistoryPanel';
import { ContactTasksPanel } from '@/components/contacts/ContactTasksPanel';
import { ContactMeetingHistory } from '@/components/contacts/ContactMeetingHistory';
import { ContactCallsPanel } from '@/components/contacts/ContactCallsPanel';
import { CallModal } from '@/components/contacts/CallModal';
import { MeetingModal } from '@/components/calendar/MeetingModal';
import { DocumentAttachmentsPanel } from '@/components/documents/DocumentAttachmentsPanel';
import { ContactEmailsPanel } from '@/components/contacts/ContactEmailsPanel';
import { useGlobalModal } from '@/contexts/GlobalModalContext';
import { VisitsHelpCard } from '@/components/contacts/VisitsHelpCard';
import { HouseholdCard } from '@/components/contacts/HouseholdCard';
import { LifeEventsSection } from '@/components/life-events/LifeEventsSection';
import { EntityDetailLayout } from '@/components/entity/EntityDetailLayout';
import { PersonTabsLayout } from '@/components/entity/PersonTabsLayout';
import { useEntityRichness } from '@/hooks/useEntityRichness';
import { GenerositySection } from '@/components/generosity/GenerositySection';
import { PersonalityStrengthsPanel } from '@/components/indoles/PersonalityStrengthsPanel';
import { useTranslation } from 'react-i18next';

export default function PersonDetail() {
  const { t } = useTranslation('relationships');
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { data: people, isLoading } = useContacts();
  const { deleteRecord, isDeleting } = useDeleteWithUndo();

  const [isMeetingModalOpen, setIsMeetingModalOpen] = useState(false);
  const [isCallModalOpen, setIsCallModalOpen] = useState(false);
  const { openContactModal } = useGlobalModal();
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const { tenantId } = useTenant();

  // Find person by slug first, fall back to id for backwards compatibility
  const person = people?.find(p => p.slug === slug || p.id === slug);

  const { effectiveRichness } = useEntityRichness('person', person?.id);

  // Check if this person's email is suppressed
  const { data: isSuppressed } = useQuery({
    queryKey: ['email-suppression-check', person?.email, tenantId],
    queryFn: async () => {
      if (!person?.email || !tenantId) return false;
      const { data } = await supabase
        .from('email_suppressions')
        .select('id')
        .eq('tenant_id', tenantId)
        .ilike('email', person.email)
        .limit(1);
      return (data?.length ?? 0) > 0;
    },
    enabled: !!person?.email && !!tenantId,
  });

  const handleDelete = async () => {
    if (!person) return;
    await deleteRecord(person.id, 'contact');
    setIsDeleteDialogOpen(false);
    navigate('/people');
  };

  if (isLoading) {
    return (
      <MainLayout title={t('personDetail.personTitle')} subtitle={t('personDetail.loading')}>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </MainLayout>
    );
  }

  if (!person) {
    return (
      <MainLayout title={t('personDetail.notFound')} subtitle={t('personDetail.notFoundSubtitle')}>
        <div className="text-center py-12">
          <p className="text-muted-foreground mb-4">{t('personDetail.notFoundMessage')}</p>
          <Button onClick={() => navigate('/people')}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            {t('personDetail.backToPeople')}
          </Button>
        </div>
      </MainLayout>
    );
  }

  // ── Shared panels (used in both flat and tabbed modes) ──

  const headerAndActions = (
    <>
      {/* Back Button & Actions */}
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <Button variant="ghost" onClick={() => navigate('/people')} className="gap-2 self-start">
          <ArrowLeft className="w-4 h-4" />
          {t('personDetail.backToPeople')}
        </Button>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" className="gap-2" onClick={() => setIsMeetingModalOpen(true)}>
            <CalendarPlus className="w-4 h-4" />
            {t('personDetail.scheduleMeeting')}
          </Button>
          <Button className="gap-2" onClick={() => openContactModal(person)}>
            <Pencil className="w-4 h-4" />
            {t('personDetail.edit')}
          </Button>
        </div>
      </div>

      {/* Person Header Card */}
      <Card className="relative overflow-visible">
        {person.is_primary && (
          <Badge variant="outline" className="absolute -top-2 -right-2 text-xs bg-card">{t('personDetail.primary')}</Badge>
        )}
        <CardHeader>
          <CardTitle className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
              <User className="w-6 h-6 text-primary" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span>{person.name}</span>
                {person.is_primary && (
                  <Star className="w-4 h-4 fill-warning text-warning" />
                )}
                {isSuppressed && (
                  <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20 text-xs gap-1">
                    <ShieldBan className="w-3 h-3" /> {t('personDetail.doNotEmail')}
                  </Badge>
                )}
              </div>
              {person.title && (
                <p className="text-sm font-normal text-muted-foreground">{person.title}</p>
              )}
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-4">
            {person.email && (
              <a href={`mailto:${person.email}`} className="flex items-center gap-2 text-sm text-primary hover:underline">
                <Mail className="w-4 h-4" />
                {person.email}
              </a>
            )}
            {person.phone && (
              <button
                type="button"
                className="flex items-center gap-2 text-sm text-primary hover:underline"
                onClick={() => {
                  savePendingCall({
                    contactId: person.id,
                    contactName: person.name,
                    opportunityId: person.opportunity_id,
                    metroId: person.opportunities?.metro_id,
                  });
                  const a = document.createElement('a');
                  a.href = `tel:${person.phone}`;
                  a.click();
                  setTimeout(() => setIsCallModalOpen(true), 500);
                }}
              >
                <Phone className="w-4 h-4" />
                {person.phone}
              </button>
            )}
          </div>
          {person.opportunities?.organization && (
            <Link
              to={`/opportunities/${person.opportunities.slug || person.opportunity_id}`}
              className="flex items-center gap-2 text-sm bg-muted/30 rounded-lg p-3 hover:bg-muted/50 transition-colors"
            >
              <Building2 className="w-4 h-4 text-muted-foreground" />
              <span className="text-primary hover:underline">{person.opportunities.organization}</span>
            </Link>
          )}
          {person.events && (
            <Link
              to={`/events/${person.events.slug || person.events.id}`}
              className="flex items-center gap-2 text-sm bg-primary/5 rounded-lg p-3 hover:bg-primary/10 transition-colors"
            >
              <Calendar className="w-4 h-4 text-primary" />
              <div>
                <span className="text-muted-foreground">{t('personDetail.metAt')}</span>
                <span className="font-medium text-foreground">{person.events.event_name}</span>
                <span className="text-muted-foreground ml-1">
                  ({new Date(person.events.event_date).toLocaleDateString()})
                </span>
              </div>
            </Link>
          )}
        </CardContent>
      </Card>
    </>
  );

  const visitsAndHousehold = (
    <>
      <VisitsHelpCard contactId={person.id} contactName={person.name} />
      <GenerositySection
        contactId={person.id}
        contactName={person.name}
        hasGivenFinancially={!!(person as any).has_given_financially}
      />
      <HouseholdCard contactId={person.id} contactName={person.name} />
      <LifeEventsSection personId={person.id} personName={person.name} />
      <PersonalityStrengthsPanel
        entityType="contact"
        entityId={person.id}
        showBio
      />
      {(person as any).is_person_in_need && (
        <Badge variant="outline" className="bg-primary/10 border-primary/20 text-primary">
          {t('personDetail.personInNeed')}
        </Badge>
      )}
    </>
  );

  const panelsGrid = (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <Card><CardContent className="pt-6"><ContactTasksPanel contactId={person.id} /></CardContent></Card>
      <Card><CardContent className="pt-6"><ContactMeetingHistory contactId={person.id} contactEmail={person.email} /></CardContent></Card>
      <Card><CardContent className="pt-6"><ContactCallsPanel contactId={person.id} contactName={person.name} opportunityId={person.opportunity_id} metroId={person.opportunities?.metro_id} /></CardContent></Card>
      <Card><CardContent className="pt-6"><ContactEmailsPanel contactId={person.id} contactEmail={person.email} /></CardContent></Card>
    </div>
  );

  const documentsAndNotes = (
    <>
      <Card><CardContent className="pt-6"><DocumentAttachmentsPanel entityType="contact" entityId={person.id} entityName={person.name} /></CardContent></Card>
      <Card><CardContent className="pt-6"><NoteHistoryPanel entityType="contact" entityId={person.id} /></CardContent></Card>
    </>
  );

  const deleteSection = (
    <div className="pt-6 border-t border-border">
      <Button
        variant="destructive"
        size="lg"
        className="w-full gap-2"
        onClick={() => setIsDeleteDialogOpen(true)}
      >
        <Trash2 className="w-5 h-5" />
        {t('personDetail.deletePerson')}
      </Button>
    </div>
  );

  // ── Flat view content (richness 1) — identical to original layout ──
  const flatContent = (
    <div className="space-y-6">
      {headerAndActions}
      {visitsAndHousehold}
      {panelsGrid}
      {documentsAndNotes}
      {deleteSection}
    </div>
  );

  // ── Tabbed view content (richness 3) ──
  const tabbedContent = (
    <div className="space-y-6">
      {headerAndActions}
      <PersonTabsLayout
        personContent={
          <div className="space-y-6">
            {visitsAndHousehold}
            {panelsGrid}
          </div>
        }
        circleContent={
          <div className="space-y-6">
            <HouseholdCard contactId={person.id} contactName={person.name} />
            {person.opportunities?.organization && (
              <Card>
                <CardHeader><CardTitle className="text-base">{t('personDetail.linkedOrganization')}</CardTitle></CardHeader>
                <CardContent>
                  <Link
                    to={`/opportunities/${person.opportunities.slug || person.opportunity_id}`}
                    className="flex items-center gap-2 text-sm text-primary hover:underline"
                  >
                    <Building2 className="w-4 h-4" />
                    {person.opportunities.organization}
                  </Link>
                </CardContent>
              </Card>
            )}
          </div>
        }
      />
      {documentsAndNotes}
      {deleteSection}
    </div>
  );

  return (
    <MainLayout
      title={person.name}
      subtitle={person.title || t('personDetail.personDetails')}
      mobileTitle={person.name.split(' ')[0]}
    >
      <EntityDetailLayout
        entityType="person"
        entityId={person.id}
        entityName={person.name}
        tabbedContent={tabbedContent}
      >
        {flatContent}
      </EntityDetailLayout>

      <MeetingModal
        open={isMeetingModalOpen}
        onOpenChange={setIsMeetingModalOpen}
        selectedDate={new Date()}
        preSelectedContactId={person.id}
      />

      <CallModal
        open={isCallModalOpen}
        onOpenChange={setIsCallModalOpen}
        contactId={person.id}
        contactName={person.name}
        opportunityId={person.opportunity_id}
        metroId={person.opportunities?.metro_id}
      />

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('personDetail.deleteDialogTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('personDetail.deleteDialogDescription', { name: person.name })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('personDetail.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={isDeleting}
            >
              {isDeleting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {t('personDetail.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </MainLayout>
  );
}
