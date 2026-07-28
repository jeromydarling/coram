import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ContactSearchSelect } from '@/components/contacts/ContactSearchSelect';
import { OpportunitySearchSelect } from '@/components/opportunities/OpportunitySearchSelect';
import { useMetros } from '@/hooks/useMetros';
import { useCreateActivity, useUpdateActivity, useDeleteActivity } from '@/hooks/useActivities';
import {
  Loader2,
  Phone,
  Mail,
  Video,
  Calendar,
  MapPin,
  Users,
  Clock,
  Trash2
} from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
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
import { Database } from '@/integrations/supabase/types';
import { useTranslation } from 'react-i18next';

type ActivityType = Database['public']['Enums']['activity_type'];
type ActivityOutcome = Database['public']['Enums']['activity_outcome'];

const ACTIVITY_TYPES: { value: ActivityType; labelKey: string; icon: React.ReactNode; needsAttendance: boolean }[] = [
  { value: 'Call', labelKey: 'activities.typeCall', icon: <Phone className="w-4 h-4" />, needsAttendance: false },
  { value: 'Email', labelKey: 'activities.typeEmail', icon: <Mail className="w-4 h-4" />, needsAttendance: false },
  { value: 'Meeting', labelKey: 'activities.typeMeeting', icon: <Video className="w-4 h-4" />, needsAttendance: true },
  { value: 'Event', labelKey: 'activities.typeEvent', icon: <Calendar className="w-4 h-4" />, needsAttendance: true },
  { value: 'Site Visit', labelKey: 'activities.typeSiteVisit', icon: <MapPin className="w-4 h-4" />, needsAttendance: true },
  { value: 'Intro', labelKey: 'activities.typeIntro', icon: <Users className="w-4 h-4" />, needsAttendance: false },
  { value: 'Other', labelKey: 'activities.typeOther', icon: <Clock className="w-4 h-4" />, needsAttendance: false },
];

const OUTCOMES: { value: ActivityOutcome; labelKey: string }[] = [
  { value: 'Connected', labelKey: 'activities.outcomeConnected' },
  { value: 'Moved Stage', labelKey: 'activities.outcomeMovedStage' },
  { value: 'Follow-up Needed', labelKey: 'activities.outcomeFollowUpNeeded' },
  { value: 'No Response', labelKey: 'activities.outcomeNoResponse' },
  { value: 'Not a Fit', labelKey: 'activities.outcomeNotAFit' },
];

interface ActivityEditModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  existingActivity?: {
    id: string;
    activity_type: ActivityType;
    activity_date_time: string;
    contact_id?: string | null;
    metro_id?: string | null;
    opportunity_id?: string | null;
    notes?: string | null;
    outcome?: ActivityOutcome | null;
    next_action?: string | null;
    next_action_due?: string | null;
    attended?: boolean | null;
  };
  defaultType?: ActivityType;
}

export function ActivityEditModal({
  open,
  onOpenChange,
  existingActivity,
  defaultType = 'Call'
}: ActivityEditModalProps) {
  const { t } = useTranslation('common');
  const [activityType, setActivityType] = useState<ActivityType>(defaultType);
  const [date, setDate] = useState('');
  const [time, setTime] = useState('10:00');
  const [contactId, setContactId] = useState('');
  const [metroId, setMetroId] = useState('');
  const [opportunityId, setOpportunityId] = useState('');
  const [notes, setNotes] = useState('');
  const [outcome, setOutcome] = useState<ActivityOutcome | ''>('');
  const [nextAction, setNextAction] = useState('');
  const [nextActionDue, setNextActionDue] = useState('');
  const [attended, setAttended] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const { data: metros, isLoading: metrosLoading } = useMetros();
  const createActivity = useCreateActivity();
  const updateActivity = useUpdateActivity();
  const deleteActivity = useDeleteActivity();

  const isEditing = !!existingActivity;
  const isLoading = metrosLoading;
  const isSaving = createActivity.isPending || updateActivity.isPending;
  const isDeleting = deleteActivity.isPending;

  const currentTypeConfig = ACTIVITY_TYPES.find(t => t.value === activityType);
  const needsAttendance = currentTypeConfig?.needsAttendance ?? false;

  useEffect(() => {
    if (existingActivity) {
      setActivityType(existingActivity.activity_type);
      const activityDate = new Date(existingActivity.activity_date_time);
      setDate(format(activityDate, 'yyyy-MM-dd'));
      setTime(format(activityDate, 'HH:mm'));
      setContactId(existingActivity.contact_id || '');
      setMetroId(existingActivity.metro_id || '');
      setOpportunityId(existingActivity.opportunity_id || '');
      setNotes(existingActivity.notes || '');
      setOutcome(existingActivity.outcome || '');
      setNextAction(existingActivity.next_action || '');
      setNextActionDue(existingActivity.next_action_due ? format(new Date(existingActivity.next_action_due), 'yyyy-MM-dd') : '');
      setAttended(existingActivity.attended || false);
    } else {
      // Reset for new activity
      setActivityType(defaultType);
      setDate(format(new Date(), 'yyyy-MM-dd'));
      setTime('10:00');
      setContactId('');
      setMetroId('');
      setOpportunityId('');
      setNotes('');
      setOutcome('');
      setNextAction('');
      setNextActionDue('');
      setAttended(false);
    }
  }, [existingActivity, defaultType, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const activityDateTime = `${date}T${time}:00`;

    try {
      if (isEditing && existingActivity) {
        await updateActivity.mutateAsync({
          id: existingActivity.id,
          activity_type: activityType,
          activity_date_time: activityDateTime,
          contact_id: contactId || null,
          metro_id: metroId || null,
          opportunity_id: opportunityId || null,
          notes: notes || null,
          outcome: outcome || null,
          next_action: nextAction || null,
          next_action_due: nextActionDue || null,
          attended: needsAttendance ? attended : null
        });
      } else {
        await createActivity.mutateAsync({
          activity_id: `ACT-${Date.now()}`,
          activity_type: activityType,
          activity_date_time: activityDateTime,
          contact_id: contactId || null,
          metro_id: metroId || null,
          opportunity_id: opportunityId || null,
          notes: notes || null,
          outcome: outcome || null,
          next_action: nextAction || null,
          next_action_due: nextActionDue || null,
          attended: needsAttendance ? attended : null
        });
      }

      onOpenChange(false);
    } catch (error) {
      // Error is already handled by the mutation's onError callback
      // Modal stays open so user can retry
      console.error('Failed to save activity:', error);
    }
  };

  const handleDelete = async () => {
    if (existingActivity) {
      await deleteActivity.mutateAsync(existingActivity.id);
      setShowDeleteConfirm(false);
      onOpenChange(false);
    }
  };

  const getTypeIcon = () => {
    return currentTypeConfig?.icon || <Clock className="w-5 h-5" />;
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          className="sm:max-w-lg max-h-[90vh] overflow-y-auto"
          onInteractOutside={(e) => e.preventDefault()}
          onPointerDownOutside={(e) => e.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span className="text-primary">{getTypeIcon()}</span>
              {isEditing ? t('activities.editActivity', { type: activityType }) : t('activities.logActivity')}
            </DialogTitle>
          </DialogHeader>

          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Activity Type */}
              <div className="space-y-2">
                <Label>{t('activities.activityType')}</Label>
                <Select value={activityType} onValueChange={(v) => setActivityType(v as ActivityType)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ACTIVITY_TYPES.map(type => (
                      <SelectItem key={type.value} value={type.value}>
                        <div className="flex items-center gap-2">
                          {type.icon}
                          {t(type.labelKey)}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Attended Banner - only for types that need it */}
              {needsAttendance && (
                <div
                  className={cn(
                    "flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition-colors",
                    attended
                      ? "bg-success/10 border-success/50"
                      : "bg-destructive/10 border-destructive/50 hover:bg-destructive/15"
                  )}
                  onClick={() => setAttended(!attended)}
                >
                  <Checkbox
                    checked={attended}
                    onCheckedChange={(checked) => setAttended(checked === true)}
                    className={cn(
                      "h-5 w-5",
                      attended
                        ? "border-success data-[state=checked]:bg-success data-[state=checked]:text-success-foreground"
                        : "border-destructive"
                    )}
                  />
                  <span className={cn(
                    "font-medium",
                    attended ? "text-success" : "text-destructive"
                  )}>
                    {attended ? t('activities.attended') : t('activities.notAttendedYet')}
                  </span>
                </div>
              )}

              {/* Date and Time */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="date">{t('labels.date')}</Label>
                  <Input
                    id="date"
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="time">{t('labels.time')}</Label>
                  <Input
                    id="time"
                    type="time"
                    value={time}
                    onChange={(e) => setTime(e.target.value)}
                    required
                  />
                </div>
              </div>

              {/* Contact */}
              <div className="space-y-2">
                <Label>{t('activities.contact')}</Label>
                <ContactSearchSelect
                  value={contactId || null}
                  onChange={(id) => setContactId(id || '')}
                  placeholder={t('activities.searchContacts')}
                />
              </div>

              {/* Organization */}
              <div className="space-y-2">
                <Label>{t('activities.organization')}</Label>
                <OpportunitySearchSelect
                  value={opportunityId || null}
                  onChange={(id) => setOpportunityId(id || '')}
                  placeholder={t('activities.searchOrganizations')}
                />
              </div>

              {/* Metro */}
              <div className="space-y-2">
                <Label htmlFor="metro">{t('activities.metro')}</Label>
                <Select value={metroId || "_none"} onValueChange={(v) => setMetroId(v === "_none" ? "" : v)}>
                  <SelectTrigger>
                    <SelectValue placeholder={t('activities.selectMetro')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">{t('activities.noMetro')}</SelectItem>
                    {metros?.map(metro => (
                      <SelectItem key={metro.id} value={metro.id}>
                        {metro.metro}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Outcome */}
              <div className="space-y-2">
                <Label htmlFor="outcome">{t('activities.outcome')}</Label>
                <Select value={outcome || "_none"} onValueChange={(v) => setOutcome(v === "_none" ? "" : v as ActivityOutcome)}>
                  <SelectTrigger>
                    <SelectValue placeholder={t('activities.selectOutcome')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">{t('activities.noOutcome')}</SelectItem>
                    {OUTCOMES.map(o => (
                      <SelectItem key={o.value} value={o.value}>
                        {t(o.labelKey)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Notes */}
              <div className="space-y-2">
                <Label htmlFor="notes">{t('labels.notes')}</Label>
                <Textarea
                  id="notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder={t('activities.notesPlaceholder')}
                  rows={3}
                />
              </div>

              {/* Next Action */}
              <div className="space-y-2">
                <Label htmlFor="nextAction">{t('activities.nextAction')}</Label>
                <Input
                  id="nextAction"
                  value={nextAction}
                  onChange={(e) => setNextAction(e.target.value)}
                  placeholder={t('activities.nextActionPlaceholder')}
                />
              </div>

              {/* Next Action Due */}
              <div className="space-y-2">
                <Label htmlFor="nextActionDue">{t('activities.nextActionDue')}</Label>
                <Input
                  id="nextActionDue"
                  type="date"
                  value={nextActionDue}
                  onChange={(e) => setNextActionDue(e.target.value)}
                />
              </div>

              <div className="flex gap-2 pt-2">
                {isEditing && (
                  <Button
                    type="button"
                    variant="destructive"
                    onClick={() => setShowDeleteConfirm(true)}
                    disabled={isSaving || isDeleting}
                    className="mr-auto"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                )}
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                  disabled={isSaving}
                  className={!isEditing ? 'flex-1' : ''}
                >
                  {t('buttons.cancel')}
                </Button>
                <Button type="submit" disabled={isSaving} className="flex-1">
                  {isSaving ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      {t('loading.saving')}
                    </>
                  ) : isEditing ? t('activities.saveChanges') : t('activities.logActivity')}
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('activities.deleteActivity')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('activities.deleteActivityConfirm')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('buttons.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  {t('loading.deleting')}
                </>
              ) : t('buttons.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
