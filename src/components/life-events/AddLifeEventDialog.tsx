/**
 * AddLifeEventDialog — Form to record a structured life event.
 *
 * WHAT: Dialog with type, date (optional year for birthdays), notification/reminder toggles.
 * WHERE: PersonDetail → Life Events section.
 * WHY: Seasons of life deserve dignified, structured capture.
 */

import { useState } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { LIFE_EVENT_TYPES, VISIBILITY_OPTIONS, defaultVisibility, defaultRemindRule } from '@/hooks/useLifeEvents';
import { Loader2, Bell, CalendarClock } from 'lucide-react';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: {
    event_type: string;
    event_date: string;
    title?: string;
    description?: string;
    visibility: string;
    event_month?: number | null;
    event_day?: number | null;
    event_year?: number | null;
    notify_enabled?: boolean | null;
    remind_enabled?: boolean | null;
    remind_rule?: string | null;
  }) => Promise<void>;
  isSubmitting: boolean;
}

const MONTHS = [
  { value: 1, label: 'January' }, { value: 2, label: 'February' },
  { value: 3, label: 'March' }, { value: 4, label: 'April' },
  { value: 5, label: 'May' }, { value: 6, label: 'June' },
  { value: 7, label: 'July' }, { value: 8, label: 'August' },
  { value: 9, label: 'September' }, { value: 10, label: 'October' },
  { value: 11, label: 'November' }, { value: 12, label: 'December' },
];

const REMIND_RULES = [
  { value: 'annual', label: 'Annually' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'once', label: 'Once' },
];

export function AddLifeEventDialog({ open, onOpenChange, onSubmit, isSubmitting }: Props) {
  const [eventType, setEventType] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [visibility, setVisibility] = useState('tenant_only');
  // Birthday fields
  const [birthdayMonth, setBirthdayMonth] = useState<number | ''>('');
  const [birthdayDay, setBirthdayDay] = useState('');
  const [birthdayYear, setBirthdayYear] = useState('');
  // Notification fields
  const [notifyEnabled, setNotifyEnabled] = useState<boolean | null>(null);
  const [remindEnabled, setRemindEnabled] = useState<boolean | null>(null);
  const [remindRule, setRemindRule] = useState<string>('');

  const selectedMeta = LIFE_EVENT_TYPES.find(t => t.value === eventType);
  const isSensitive = selectedMeta && 'sensitive' in selectedMeta ? selectedMeta.sensitive : false;
  const noAutoNotify = selectedMeta && 'noAutoNotify' in selectedMeta ? selectedMeta.noAutoNotify : false;
  const isBirthday = eventType === 'birthday';

  const resetForm = () => {
    setEventType('');
    setEventDate('');
    setTitle('');
    setDescription('');
    setVisibility('tenant_only');
    setBirthdayMonth('');
    setBirthdayDay('');
    setBirthdayYear('');
    setNotifyEnabled(null);
    setRemindEnabled(null);
    setRemindRule('');
  };

  const handleTypeChange = (val: string) => {
    setEventType(val);
    setVisibility(defaultVisibility(val));
    const rule = defaultRemindRule(val);
    setRemindRule(rule ?? '');
    // Sensitive events with noAutoNotify default to off
    const meta = LIFE_EVENT_TYPES.find(t => t.value === val);
    if (meta && 'noAutoNotify' in meta && meta.noAutoNotify) {
      setNotifyEnabled(false);
      setRemindEnabled(false);
    } else {
      setNotifyEnabled(null);
      setRemindEnabled(null);
    }
  };

  const buildEventDate = (): string => {
    if (isBirthday) {
      const yr = birthdayYear ? parseInt(birthdayYear) : 2000;
      const mo = String(birthdayMonth).padStart(2, '0');
      const dy = String(birthdayDay).padStart(2, '0');
      return `${yr}-${mo}-${dy}`;
    }
    return eventDate;
  };

  const isValid = () => {
    if (!eventType) return false;
    if (isBirthday) return birthdayMonth !== '' && birthdayDay !== '';
    return !!eventDate;
  };

  const handleSubmit = async () => {
    if (!isValid()) return;
    await onSubmit({
      event_type: eventType,
      event_date: buildEventDate(),
      title,
      description,
      visibility,
      event_month: isBirthday && birthdayMonth !== '' ? Number(birthdayMonth) : null,
      event_day: isBirthday && birthdayDay ? parseInt(birthdayDay) : null,
      event_year: isBirthday && birthdayYear ? parseInt(birthdayYear) : null,
      notify_enabled: notifyEnabled,
      remind_enabled: remindEnabled,
      remind_rule: remindRule || null,
    });
    resetForm();
    onOpenChange(false);
  };

  const handleOpenChange = (val: boolean) => {
    if (!val) resetForm();
    onOpenChange(val);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Record a Life Event</DialogTitle>
          <DialogDescription className="text-muted-foreground text-sm">
            A dignified record of a meaningful moment.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Event Type */}
          <div className="space-y-1.5">
            <Label>Event type</Label>
            <Select value={eventType} onValueChange={handleTypeChange}>
              <SelectTrigger><SelectValue placeholder="Select type…" /></SelectTrigger>
              <SelectContent>
                {LIFE_EVENT_TYPES.map(t => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Sensitive notice */}
          {isSensitive && (
            <p className="text-xs text-muted-foreground bg-muted/50 rounded-md p-2.5 border border-border/50">
              This event will not be publicly visible. It is stored with care and dignity.
            </p>
          )}

          {/* Birthday date fields */}
          {isBirthday ? (
            <div className="space-y-1.5">
              <Label>Birthday <span className="text-muted-foreground font-normal">(year optional)</span></Label>
              <div className="flex gap-2">
                <Select
                  value={birthdayMonth !== '' ? String(birthdayMonth) : ''}
                  onValueChange={v => setBirthdayMonth(parseInt(v))}
                >
                  <SelectTrigger className="flex-1"><SelectValue placeholder="Month" /></SelectTrigger>
                  <SelectContent>
                    {MONTHS.map(m => (
                      <SelectItem key={m.value} value={String(m.value)}>{m.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  className="w-20"
                  type="number"
                  min={1}
                  max={31}
                  placeholder="Day"
                  value={birthdayDay}
                  onChange={e => setBirthdayDay(e.target.value)}
                />
                <Input
                  className="w-24"
                  type="number"
                  min={1900}
                  max={2100}
                  placeholder="Year"
                  value={birthdayYear}
                  onChange={e => setBirthdayYear(e.target.value)}
                />
              </div>
            </div>
          ) : (
            <div className="space-y-1.5">
              <Label>Date</Label>
              <Input type="date" value={eventDate} onChange={e => setEventDate(e.target.value)} />
            </div>
          )}

          {/* Title */}
          <div className="space-y-1.5">
            <Label>Title <span className="text-muted-foreground font-normal">(optional)</span></Label>
            <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="A brief title…" />
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label>Description <span className="text-muted-foreground font-normal">(optional)</span></Label>
            <Textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Any context you'd like to remember…"
              rows={3}
            />
          </div>

          {/* Visibility */}
          <div className="space-y-1.5">
            <Label>Visibility</Label>
            <Select value={visibility} onValueChange={setVisibility}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {VISIBILITY_OPTIONS.map(v => (
                  <SelectItem key={v.value} value={v.value}>{v.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Notification + Reminder toggles */}
          {eventType && (
            <div className="space-y-3 rounded-lg border border-border/60 p-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm">
                  <Bell className="w-3.5 h-3.5 text-muted-foreground" />
                  <span>Notify team when recorded</span>
                </div>
                <Switch
                  checked={notifyEnabled === true}
                  onCheckedChange={v => setNotifyEnabled(v)}
                  disabled={noAutoNotify && notifyEnabled !== true}
                />
              </div>
              {noAutoNotify && notifyEnabled !== true && (
                <p className="text-xs text-muted-foreground pl-5">
                  Notifications are off by default for sensitive events. Enable explicitly if needed.
                </p>
              )}

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm">
                  <CalendarClock className="w-3.5 h-3.5 text-muted-foreground" />
                  <span>Schedule reminders</span>
                </div>
                <Switch
                  checked={remindEnabled === true}
                  onCheckedChange={v => setRemindEnabled(v)}
                />
              </div>

              {remindEnabled && (
                <div className="pl-5 space-y-1.5">
                  <Label className="text-xs">Reminder frequency</Label>
                  <Select value={remindRule} onValueChange={setRemindRule}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select…" /></SelectTrigger>
                    <SelectContent>
                      {REMIND_RULES.map(r => (
                        <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => handleOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={!isValid() || isSubmitting}>
            {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
