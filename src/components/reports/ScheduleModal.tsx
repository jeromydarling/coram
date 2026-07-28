import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { X, Loader2, Mail, Clock, Calendar } from 'lucide-react';
import { ReportSchedule, ReportTemplate } from '@/hooks/useReportTemplates';
import { useMetros } from '@/hooks/useMetros';
import { useRegions } from '@/hooks/useRegions';

interface ScheduleModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (schedule: Omit<ReportSchedule, 'id' | 'created_at' | 'updated_at' | 'created_by' | 'last_sent_at'>) => void;
  templates: ReportTemplate[];
  schedule?: ReportSchedule;
  isLoading?: boolean;
}

const DAYS_OF_WEEK = [
  { value: 0, label: 'Sunday' },
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
  { value: 6, label: 'Saturday' },
];

const TIMEZONES = [
  { value: 'America/New_York', label: 'Eastern Time (ET)' },
  { value: 'America/Chicago', label: 'Central Time (CT)' },
  { value: 'America/Denver', label: 'Mountain Time (MT)' },
  { value: 'America/Los_Angeles', label: 'Pacific Time (PT)' },
];

export function ScheduleModal({
  open,
  onClose,
  onSave,
  templates,
  schedule,
  isLoading,
}: ScheduleModalProps) {
  const { data: metros } = useMetros();
  const { data: regions } = useRegions();
  
  const [name, setName] = useState('');
  const [templateId, setTemplateId] = useState('');
  const [frequency, setFrequency] = useState<'daily' | 'weekly' | 'monthly'>('weekly');
  const [dayOfWeek, setDayOfWeek] = useState<number>(1);
  const [dayOfMonth, setDayOfMonth] = useState<number>(1);
  const [timeOfDay, setTimeOfDay] = useState('08:00');
  const [timezone, setTimezone] = useState('America/Chicago');
  const [regionId, setRegionId] = useState<string>('');
  const [metroId, setMetroId] = useState<string>('');
  const [recipients, setRecipients] = useState<string[]>([]);
  const [newEmail, setNewEmail] = useState('');

  useEffect(() => {
    if (schedule) {
      setName(schedule.name);
      setTemplateId(schedule.template_id || '');
      setFrequency(schedule.frequency);
      setDayOfWeek(schedule.day_of_week ?? 1);
      setDayOfMonth(schedule.day_of_month ?? 1);
      setTimeOfDay(schedule.time_of_day.slice(0, 5));
      setTimezone(schedule.timezone);
      setRegionId(schedule.region_id || '');
      setMetroId(schedule.metro_id || '');
      setRecipients(schedule.recipients);
    } else {
      setName('');
      setTemplateId(templates[0]?.id || '');
      setFrequency('weekly');
      setDayOfWeek(1);
      setDayOfMonth(1);
      setTimeOfDay('08:00');
      setTimezone('America/Chicago');
      setRegionId('');
      setMetroId('');
      setRecipients([]);
    }
  }, [schedule, templates, open]);

  const addRecipient = () => {
    const email = newEmail.trim().toLowerCase();
    if (email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && !recipients.includes(email)) {
      setRecipients([...recipients, email]);
      setNewEmail('');
    }
  };

  const removeRecipient = (email: string) => {
    setRecipients(recipients.filter(r => r !== email));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addRecipient();
    }
  };

  const handleSave = () => {
    if (!name.trim() || recipients.length === 0) return;

    onSave({
      name: name.trim(),
      template_id: templateId || null,
      frequency,
      day_of_week: frequency === 'weekly' ? dayOfWeek : null,
      day_of_month: frequency === 'monthly' ? dayOfMonth : null,
      time_of_day: timeOfDay + ':00',
      timezone,
      region_id: regionId || null,
      metro_id: metroId || null,
      recipients,
      is_active: true,
    });
  };

  const filteredMetros = regionId
    ? metros?.filter(m => m.region_id === regionId)
    : metros;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            {schedule ? 'Edit Schedule' : 'New Scheduled Report'}
          </DialogTitle>
          <DialogDescription>
            Configure automatic email delivery of reports
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Schedule Name */}
          <div className="space-y-2">
            <Label>Schedule Name *</Label>
            <Input
              placeholder="e.g., Weekly Leadership Update"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          {/* Template Selection */}
          <div className="space-y-2">
            <Label>Report Template</Label>
            <Select value={templateId} onValueChange={setTemplateId}>
              <SelectTrigger>
                <SelectValue placeholder="Select a template" />
              </SelectTrigger>
              <SelectContent>
                {templates.map(t => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Frequency */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Clock className="w-4 h-4" />
                Frequency
              </Label>
              <Select value={frequency} onValueChange={(v) => setFrequency(v as typeof frequency)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {frequency === 'weekly' && (
              <div className="space-y-2">
                <Label>Day of Week</Label>
                <Select value={String(dayOfWeek)} onValueChange={(v) => setDayOfWeek(Number(v))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DAYS_OF_WEEK.map(d => (
                      <SelectItem key={d.value} value={String(d.value)}>
                        {d.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {frequency === 'monthly' && (
              <div className="space-y-2">
                <Label>Day of Month</Label>
                <Select value={String(dayOfMonth)} onValueChange={(v) => setDayOfMonth(Number(v))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 28 }, (_, i) => i + 1).map(d => (
                      <SelectItem key={d} value={String(d)}>
                        {d}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          {/* Time and Timezone */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Time</Label>
              <Input
                type="time"
                value={timeOfDay}
                onChange={(e) => setTimeOfDay(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Timezone</Label>
              <Select value={timezone} onValueChange={setTimezone}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIMEZONES.map(tz => (
                    <SelectItem key={tz.value} value={tz.value}>
                      {tz.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Scope */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Region (optional)</Label>
              <Select value={regionId || "_all"} onValueChange={(v) => { setRegionId(v === "_all" ? "" : v); setMetroId(''); }}>
                <SelectTrigger>
                  <SelectValue placeholder="All Regions" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_all">All Regions</SelectItem>
                  {regions?.map(r => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Metro (optional)</Label>
              <Select value={metroId || "_all"} onValueChange={(v) => setMetroId(v === "_all" ? "" : v)}>
                <SelectTrigger>
                  <SelectValue placeholder="All Metros" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_all">All Metros</SelectItem>
                  {filteredMetros?.map(m => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.metro}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Recipients */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Mail className="w-4 h-4" />
              Recipients *
            </Label>
            <div className="flex gap-2">
              <Input
                placeholder="email@example.com"
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                onKeyDown={handleKeyDown}
              />
              <Button type="button" variant="outline" onClick={addRecipient}>
                Add
              </Button>
            </div>
            {recipients.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {recipients.map(email => (
                  <Badge key={email} variant="secondary" className="gap-1">
                    {email}
                    <X
                      className="w-3 h-3 cursor-pointer hover:text-destructive"
                      onClick={() => removeRecipient(email)}
                    />
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button 
            onClick={handleSave} 
            disabled={!name.trim() || recipients.length === 0 || isLoading}
          >
            {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {schedule ? 'Update Schedule' : 'Create Schedule'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
