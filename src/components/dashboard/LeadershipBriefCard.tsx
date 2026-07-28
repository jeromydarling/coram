import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { HelpTooltip } from '@/components/ui/help-tooltip';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useLatestWeeklyReport, useGenerateWeeklyReport, useUpdateWeeklyReport, useBriefSchedule, useUpdateBriefSchedule, DAY_LABELS } from '@/hooks/useWeeklyReport';
import type { WeeklyReportJson } from '@/hooks/useWeeklyReport';
import {
  ScrollText,
  RefreshCw,
  Users,
  Rocket,
  Calendar,
  AlertTriangle,
  Trophy,
  Building2,
  Mail,
  Radio,
  Pencil,
  Save,
  X,
  Download,
  Package,
  Route,
  Settings2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { format, parseISO } from 'date-fns';
import { downloadLeadershipBriefPdf } from '@/lib/leadershipBriefPdf';

const LOOKBACK_PRESETS = [
  { value: '7', label: '7 days' },
  { value: '14', label: '14 days' },
  { value: '30', label: '30 days' },
  { value: 'custom', label: 'Custom' },
];

function BriefSchedulePopover() {
  const { data: schedule, isLoading } = useBriefSchedule();
  const updateSchedule = useUpdateBriefSchedule();
  const [customDays, setCustomDays] = useState('');
  const [open, setOpen] = useState(false);
  const { t } = useTranslation('dashboard');

  const currentLookback = schedule?.brief_lookback_days ?? 7;
  const isPreset = [7, 14, 30].includes(currentLookback);
  const selectValue = isPreset ? String(currentLookback) : 'custom';

  useEffect(() => {
    if (!isPreset && schedule) {
      setCustomDays(String(currentLookback));
    }
  }, [schedule, isPreset, currentLookback]);

  const handleDayChange = (day: string) => {
    updateSchedule.mutate({ brief_report_day: Number(day) });
  };

  const handleLookbackChange = (val: string) => {
    if (val === 'custom') {
      setCustomDays(String(currentLookback));
    } else {
      updateSchedule.mutate({ brief_lookback_days: Number(val) });
    }
  };

  const handleCustomSave = () => {
    const days = Number(customDays);
    if (days >= 1 && days <= 90) {
      updateSchedule.mutate({ brief_lookback_days: days });
    }
  };

  if (isLoading) return null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" title={t('leadershipBrief.briefSchedule')}>
          <Settings2 className="w-4 h-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64 space-y-4">
        <div className="space-y-1">
          <p className="text-sm font-medium">{t('leadershipBrief.briefSchedule')}</p>
          <p className="text-xs text-muted-foreground">{t('leadershipBrief.briefScheduleDescription')}</p>
        </div>

        <div className="space-y-2">
          <Label className="text-xs">{t('leadershipBrief.generateOn')}</Label>
          <Select value={String(schedule?.brief_report_day ?? 1)} onValueChange={handleDayChange}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DAY_LABELS.map((label, i) => (
                <SelectItem key={i} value={String(i)}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label className="text-xs">{t('leadershipBrief.lookbackPeriod')}</Label>
          <Select value={selectValue} onValueChange={handleLookbackChange}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LOOKBACK_PRESETS.map(p => (
                <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {selectValue === 'custom' && (
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min={1}
                max={90}
                value={customDays}
                onChange={(e) => setCustomDays(e.target.value)}
                className="h-8 text-xs w-20"
                placeholder={t('leadershipBrief.days')}
              />
              <span className="text-xs text-muted-foreground">{t('leadershipBrief.days')}</span>
              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={handleCustomSave} disabled={updateSchedule.isPending}>
                {t('leadershipBrief.set')}
              </Button>
            </div>
          )}
        </div>

        <p className="text-[10px] text-muted-foreground leading-relaxed">
          {schedule ? t('leadershipBrief.currently', { day: DAY_LABELS[schedule.brief_report_day], lookback: schedule.brief_lookback_days }) : ''}
        </p>
      </PopoverContent>
    </Popover>
  );
}

export function LeadershipBriefCard() {
  const { data: report, isLoading } = useLatestWeeklyReport();
  const generateReport = useGenerateWeeklyReport();
  const updateReport = useUpdateWeeklyReport();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editDraft, setEditDraft] = useState<WeeklyReportJson | null>(null);
  const { t } = useTranslation('dashboard');

  // Reset edit state when modal closes
  useEffect(() => {
    if (!modalOpen) {
      setEditing(false);
      setEditDraft(null);
    }
  }, [modalOpen]);

  const startEditing = useCallback(() => {
    if (!report) return;
    setEditDraft({ ...report.report_json });
    setEditing(true);
  }, [report]);

  const cancelEditing = useCallback(() => {
    setEditing(false);
    setEditDraft(null);
  }, []);

  const saveEdits = useCallback(async () => {
    if (!report || !editDraft) return;
    await updateReport.mutateAsync({ id: report.id, report_json: editDraft });
    setEditing(false);
    setEditDraft(null);
  }, [report, editDraft, updateReport]);

  const handleDownloadPdf = useCallback(() => {
    if (!report) return;
    const weekLabel = format(parseISO(report.week_of_date), 'MMM d, yyyy');
    downloadLeadershipBriefPdf({ report: report.report_json, weekLabel });
  }, [report]);

  const updateField = useCallback((field: keyof WeeklyReportJson, value: string) => {
    if (!editDraft) return;
    setEditDraft({ ...editDraft, [field]: value });
  }, [editDraft]);

  const updateArrayField = useCallback((field: keyof WeeklyReportJson, index: number, value: string) => {
    if (!editDraft) return;
    const arr = [...((editDraft[field] as string[]) || [])];
    arr[index] = value;
    setEditDraft({ ...editDraft, [field]: arr });
  }, [editDraft]);

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <Skeleton className="h-5 w-48" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-20 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!report) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-8 text-center">
          <ScrollText className="w-10 h-10 mx-auto mb-3 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground mb-3">{t('leadershipBrief.noReportYet')}</p>
          <div className="flex items-center justify-center gap-2">
            <Button
              size="sm"
              onClick={() => generateReport.mutate()}
              disabled={generateReport.isPending}
            >
              {generateReport.isPending ? (
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <ScrollText className="w-4 h-4 mr-2" />
              )}
              {t('leadershipBrief.generateNow')}
            </Button>
            <BriefSchedulePopover />
          </div>
        </CardContent>
      </Card>
    );
  }

  const r = report.report_json;
  const weekLabel = format(parseISO(report.week_of_date), 'MMM d, yyyy');
  const lookbackLabel = r._lookback_days && r._lookback_days !== 7 ? ` · Last ${r._lookback_days} days` : '';

  // Resolve sections with backward compat
  const displayReport = editing && editDraft ? editDraft : r;
  const journeyMovement = displayReport.journey_movement || displayReport.pipeline_momentum || [];
  const outreachReport = displayReport.outreach_report || displayReport.outreach_performance || [];
  const provisionsDelivered = displayReport.provisions_delivered || [];
  const risksOrConcerns = displayReport.risks_or_concerns || displayReport.risks_or_blockers || [];

  return (
    <>
      <Card className="border-primary/20">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="min-w-0">
              <CardTitle className="flex items-center gap-2 text-base">
                <ScrollText className="w-4 h-4 text-primary shrink-0" />
                <span className="truncate">{t('leadershipBrief.title')}</span>
                <HelpTooltip contentKey="card.leadership-brief" />
              </CardTitle>
              <CardDescription className="text-xs mt-1">
                {weekLabel}{lookbackLabel}
              </CardDescription>
            </div>
            <div className="flex items-center gap-0.5">
              <BriefSchedulePopover />
              <Button
                variant="ghost"
                size="sm"
                onClick={() => generateReport.mutate()}
                disabled={generateReport.isPending}
                title={t('leadershipBrief.regenerateReport')}
              >
                <RefreshCw className={cn("w-4 h-4", generateReport.isPending && "animate-spin")} />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="p-3 rounded-lg bg-primary/5 border border-primary/10">
            <p className="font-semibold text-sm">{r.headline}</p>
          </div>

          <Button
            variant="ghost"
            size="sm"
            className="w-full text-xs"
            onClick={() => setModalOpen(true)}
          >
            <ScrollText className="w-3 h-3 mr-1" />
            {t('leadershipBrief.viewFullBrief')}
          </Button>
        </CardContent>
      </Card>

      {/* Full Brief Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <DialogTitle className="flex items-center gap-2">
                <ScrollText className="w-5 h-5 text-primary" />
                {t('leadershipBrief.title')} — {weekLabel}{lookbackLabel}
              </DialogTitle>
              <div className="flex items-center gap-1">
                {editing ? (
                  <>
                    <Button variant="ghost" size="sm" onClick={cancelEditing} title={t('leadershipBrief.cancelEditing')}>
                      <X className="w-4 h-4" />
                    </Button>
                    <Button size="sm" onClick={saveEdits} disabled={updateReport.isPending} title={t('leadershipBrief.saveChanges')}>
                      {updateReport.isPending ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                      <span className="ml-1 text-xs">{t('leadershipBrief.save')}</span>
                    </Button>
                  </>
                ) : (
                  <>
                    <Button variant="ghost" size="sm" onClick={startEditing} title={t('leadershipBrief.editBrief')}>
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={handleDownloadPdf} title={t('leadershipBrief.downloadPdf')}>
                      <Download className="w-4 h-4" />
                    </Button>
                  </>
                )}
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            {/* Headline */}
            <div className="p-3 rounded-lg bg-primary/5 border border-primary/10">
              {editing ? (
                <Textarea
                  value={editDraft?.headline || ''}
                  onChange={(e) => updateField('headline', e.target.value)}
                  className="min-h-[40px] text-sm font-semibold resize-none"
                  rows={1}
                />
              ) : (
                <p className="font-semibold text-sm">{displayReport.headline}</p>
              )}
            </div>

            {/* Executive Summary */}
            {editing ? (
              <Textarea
                value={editDraft?.executive_summary || ''}
                onChange={(e) => updateField('executive_summary', e.target.value)}
                className="min-h-[60px] text-sm resize-none"
                rows={3}
              />
            ) : (
              <p className="text-sm text-muted-foreground leading-relaxed">
                {displayReport.executive_summary}
              </p>
            )}

            {/* Key Wins */}
            <EditableBriefSection
              icon={Trophy}
              label={t('leadershipBrief.sections.keyWins')}
              items={displayReport.key_wins}
              field="key_wins"
              editing={editing}
              onUpdate={updateArrayField}
            />

            {/* Relationship Growth */}
            <EditableBriefSection
              icon={Users}
              label={t('leadershipBrief.sections.relationshipGrowth')}
              items={displayReport.relationship_growth}
              field="relationship_growth"
              editing={editing}
              onUpdate={updateArrayField}
            />

            {/* Journey Movement */}
            <EditableBriefSection
              icon={Route}
              label={t('leadershipBrief.sections.journeyMovement')}
              items={journeyMovement}
              field="journey_movement"
              editing={editing}
              onUpdate={updateArrayField}
            />

            {/* Outreach Report */}
            <EditableBriefSection
              icon={Mail}
              label={t('leadershipBrief.sections.outreachReport')}
              items={outreachReport}
              field="outreach_report"
              editing={editing}
              onUpdate={updateArrayField}
            />

            {/* Provisions Delivered */}
            <EditableBriefSection
              icon={Package}
              label={t('leadershipBrief.sections.provisionsDelivered')}
              items={provisionsDelivered}
              field="provisions_delivered"
              editing={editing}
              onUpdate={updateArrayField}
            />

            {/* Engagement Signals */}
            <EditableBriefSection
              icon={Radio}
              label={t('leadershipBrief.sections.engagementSignals')}
              items={displayReport.engagement_signals}
              field="engagement_signals"
              editing={editing}
              onUpdate={updateArrayField}
            />

            {/* New Opportunities (legacy compat) */}
            {displayReport.new_opportunities && displayReport.new_opportunities.length > 0 && (
              <EditableBriefSection
                icon={Building2}
                label={t('leadershipBrief.sections.newOpportunities')}
                items={displayReport.new_opportunities}
                field="new_opportunities"
                editing={editing}
                onUpdate={updateArrayField}
              />
            )}

            {/* Upcoming Focus */}
            <EditableBriefSection
              icon={Rocket}
              label={t('leadershipBrief.sections.upcomingFocus')}
              items={displayReport.upcoming_focus}
              field="upcoming_focus"
              editing={editing}
              onUpdate={updateArrayField}
            />

            {/* Risks / Concerns */}
            {(risksOrConcerns.filter(Boolean).length > 0 || editing) && (
              <div className="space-y-1.5">
                <div className="flex items-center gap-1.5 text-xs font-medium text-destructive uppercase tracking-wider">
                  <AlertTriangle className="w-3 h-3" />
                  {t('leadershipBrief.sections.concerns')}
                </div>
                {editing ? (
                  (editDraft?.risks_or_concerns || []).map((item, i) => (
                    <Textarea
                      key={i}
                      value={item || ''}
                      onChange={(e) => updateArrayField('risks_or_concerns', i, e.target.value)}
                      className="min-h-[32px] text-sm resize-none"
                      rows={1}
                    />
                  ))
                ) : (
                  risksOrConcerns.filter(Boolean).map((item, i) => (
                    <p key={i} className="text-sm pl-4 text-destructive/80">• {item}</p>
                  ))
                )}
              </div>
            )}

            {/* Calendar Preview */}
            <EditableBriefSection
              icon={Calendar}
              label={t('leadershipBrief.sections.calendarAhead')}
              items={displayReport.calendar_preview}
              field="calendar_preview"
              editing={editing}
              onUpdate={updateArrayField}
              muted
            />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function EditableBriefSection({
  icon: Icon,
  label,
  items,
  field,
  editing,
  onUpdate,
  muted,
}: {
  icon: React.ElementType;
  label: string;
  items: (string | null)[] | undefined;
  field: keyof WeeklyReportJson;
  editing: boolean;
  onUpdate: (field: keyof WeeklyReportJson, index: number, value: string) => void;
  muted?: boolean;
}) {
  const filtered = (items || []).filter(Boolean) as string[];
  if (!editing && filtered.length === 0) return null;

  return (
    <div className="space-y-1.5">
      <div className={cn(
        "flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider",
        muted ? "text-muted-foreground" : "text-muted-foreground"
      )}>
        <Icon className="w-3 h-3" />
        {label}
      </div>
      {editing ? (
        (items || []).map((item, i) => (
          <Textarea
            key={i}
            value={(item as string) || ''}
            onChange={(e) => onUpdate(field, i, e.target.value)}
            className="min-h-[32px] text-sm resize-none"
            rows={1}
          />
        ))
      ) : (
        filtered.map((item, i) => (
          <p key={i} className={cn("text-sm pl-4", muted ? "text-muted-foreground" : "")}>• {item}</p>
        ))
      )}
    </div>
  );
}
