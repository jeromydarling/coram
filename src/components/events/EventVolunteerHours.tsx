import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useVolunteers, useCreateShift } from '@/hooks/useVolunteers';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Clock, Plus } from 'lucide-react';
import { format } from 'date-fns';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface EventVolunteerHoursProps {
  eventId: string;
}

export function EventVolunteerHours({ eventId }: EventVolunteerHoursProps) {
  const { t } = useTranslation('events');
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [volunteerId, setVolunteerId] = useState('');
  const [shiftDate, setShiftDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [hours, setHours] = useState('');

  const { data: volunteers } = useVolunteers();
  const createShift = useCreateShift();

  const { data: shifts, isLoading } = useQuery({
    queryKey: ['event-volunteer-shifts', eventId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('volunteer_shifts')
        .select('*, volunteers(id, first_name, last_name)')
        .eq('event_id', eventId)
        .order('shift_date', { ascending: false });
      if (error) throw error;
      return data as any[];
    },
    enabled: !!eventId,
  });

  const handleSubmit = () => {
    if (!volunteerId || !hours || !shiftDate) return;
    const minutes = Math.round(parseFloat(hours) * 60 / 5) * 5;
    if (minutes <= 0 || minutes > 1440) return;

    createShift.mutate(
      {
        volunteer_id: volunteerId,
        kind: 'event',
        event_id: eventId,
        shift_date: shiftDate,
        minutes,
        created_by: user?.id,
      },
      {
        onSuccess: () => {
          setOpen(false);
          setVolunteerId('');
          setHours('');
        },
      }
    );
  };

  const totalMinutes = shifts?.reduce((sum, s) => sum + s.minutes, 0) || 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-primary" />
            {t('volunteerHours.title')}
            {shifts && shifts.length > 0 && (
              <Badge variant="secondary">{t('volunteerHours.totalHours', { hours: (totalMinutes / 60).toFixed(1) })}</Badge>
            )}
          </div>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Dialog open={open} onOpenChange={setOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm" variant="outline" className="gap-1">
                      <Plus className="w-3 h-3" />
                      {t('volunteerHours.logHours')}
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>{t('volunteerHours.dialogTitle')}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label>{t('volunteerHours.volunteer')}</Label>
                        <Select value={volunteerId} onValueChange={setVolunteerId}>
                          <SelectTrigger>
                            <SelectValue placeholder={t('volunteerHours.selectVolunteer')} />
                          </SelectTrigger>
                          <SelectContent>
                            {volunteers?.map((v) => (
                              <SelectItem key={v.id} value={v.id}>
                                {v.first_name} {v.last_name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>{t('volunteerHours.date')}</Label>
                        <Input type="date" value={shiftDate} onChange={(e) => setShiftDate(e.target.value)} />
                      </div>
                      <div className="space-y-2">
                        <Label>{t('volunteerHours.hours')}</Label>
                        <Input type="number" step="0.5" min="0.25" max="24" value={hours} onChange={(e) => setHours(e.target.value)} placeholder={t('volunteerHours.hoursPlaceholder')} />
                      </div>
                      <Button onClick={handleSubmit} disabled={createShift.isPending || !volunteerId || !hours} className="w-full">
                        {createShift.isPending ? t('volunteerHours.logging') : t('volunteerHours.logHours')}
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </TooltipTrigger>
              <TooltipContent>
                <p><strong>What:</strong> Log volunteer hours for this event</p>
                <p><strong>Where:</strong> Links to a registered volunteer</p>
                <p><strong>Why:</strong> Track community engagement per event</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">{t('volunteerHours.loading')}</p>
        ) : !shifts || shifts.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('volunteerHours.noHours')}</p>
        ) : (
          <div className="space-y-2">
            {shifts.map((shift) => (
              <div key={shift.id} className="flex items-center justify-between text-sm border-b border-border pb-2 last:border-0">
                <div>
                  <span className="font-medium">
                    {shift.volunteers?.first_name} {shift.volunteers?.last_name}
                  </span>
                  <span className="text-muted-foreground ml-2">
                    {format(new Date(shift.shift_date), 'MMM d, yyyy')}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-medium">{(shift.minutes / 60).toFixed(1)}h</span>
                  <Badge variant="outline" className="text-xs">{shift.source}</Badge>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
