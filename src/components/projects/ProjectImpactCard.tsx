/**
 * ProjectImpactCard — Calm, optional impact snapshot for a Project.
 *
 * WHAT: Editable card with people_helped, attendance_count, outcome_note.
 * WHERE: ProjectDetail page.
 * WHY: Feeds Testimonium rollups and NRI signals — lightweight year-end data.
 */

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { HelpTooltip } from '@/components/ui/help-tooltip';
import { Heart, Users, Loader2, Save } from 'lucide-react';
import { useProjectImpact, useSaveProjectImpact } from '@/hooks/useProjectImpact';

interface Props {
  activityId: string;
}

export function ProjectImpactCard({ activityId }: Props) {
  const { data: impact, isLoading } = useProjectImpact(activityId);
  const save = useSaveProjectImpact();

  const [peopleHelped, setPeopleHelped] = useState<string>('');
  const [attendanceCount, setAttendanceCount] = useState<string>('');
  const [outcomeNote, setOutcomeNote] = useState('');
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (impact) {
      setPeopleHelped(impact.people_helped?.toString() ?? '');
      setAttendanceCount(impact.attendance_count?.toString() ?? '');
      setOutcomeNote(impact.outcome_note ?? '');
      setDirty(false);
    }
  }, [impact]);

  const handleSave = () => {
    save.mutate({
      activityId,
      peopleHelped: peopleHelped ? parseInt(peopleHelped, 10) : null,
      attendanceCount: attendanceCount ? parseInt(attendanceCount, 10) : null,
      outcomeNote: outcomeNote.trim() || null,
    });
    setDirty(false);
  };

  const markDirty = () => setDirty(true);

  if (isLoading) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Heart className="h-4 w-4 text-primary" />
          Impact
          <HelpTooltip
            what="Optional snapshot of this project's impact."
            where="Project detail page."
            why="Feeds year-end reporting and NRI narrative signals."
          />
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">People helped</label>
            <Input
              type="number"
              min={0}
              placeholder="—"
              value={peopleHelped}
              onChange={e => { setPeopleHelped(e.target.value); markDirty(); }}
              className="h-9"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Attendance</label>
            <Input
              type="number"
              min={0}
              placeholder="—"
              value={attendanceCount}
              onChange={e => { setAttendanceCount(e.target.value); markDirty(); }}
              className="h-9"
            />
          </div>
        </div>
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">What happened?</label>
          <Textarea
            placeholder="A short note about the outcome…"
            value={outcomeNote}
            onChange={e => { setOutcomeNote(e.target.value); markDirty(); }}
            rows={2}
            className="resize-none"
          />
        </div>
        {dirty && (
          <Button
            size="sm"
            onClick={handleSave}
            disabled={save.isPending}
            className="gap-1.5"
          >
            {save.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            Save Impact
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
