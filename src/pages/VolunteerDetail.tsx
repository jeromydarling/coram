import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, ArrowLeft, Clock, Calendar, Edit, Plus, Warehouse } from 'lucide-react';
import VolunteerTagSelector from '@/components/volunteers/VolunteerTagSelector';
import { useVolunteer, useVolunteerShifts, useUpdateVolunteer, useCreateShift, getReliabilityLabel } from '@/hooks/useVolunteers';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { useTenantNavigate } from '@/hooks/useTenantPath';
import { PersonalityStrengthsPanel } from '@/components/indoles/PersonalityStrengthsPanel';

export default function VolunteerDetail() {
  const { t } = useTranslation('volunteers');
  const { id } = useParams<{ id: string }>();
  const navigate = useTenantNavigate();
  const { user } = useAuth();
  const [showEdit, setShowEdit] = useState(false);
  const [showLogHours, setShowLogHours] = useState(false);

  const { data: volunteer, isLoading } = useVolunteer(id);
  const { data: shifts } = useVolunteerShifts(id);
  const updateVolunteer = useUpdateVolunteer();
  const createShift = useCreateShift();

  const [editForm, setEditForm] = useState<Record<string, string>>({});
  const [shiftForm, setShiftForm] = useState({
    shift_date: format(new Date(), 'yyyy-MM-dd'),
    hours: '1',
    kind: 'warehouse',
    event_id: '',
  });

  // Load events for the picker
  const { data: events } = useQuery({
    queryKey: ['events-for-shift-picker'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('events')
        .select('id, event_name')
        .order('event_name');
      if (error) throw error;
      return data;
    },
  });

  const openEdit = () => {
    if (!volunteer) return;
    setEditForm({
      first_name: volunteer.first_name,
      last_name: volunteer.last_name,
      email: volunteer.email,
      phone: volunteer.phone || '',
      address: volunteer.address || '',
      city: volunteer.city || '',
      state: volunteer.state || '',
      zip: volunteer.zip || '',
      status: volunteer.status,
      notes: volunteer.notes || '',
    });
    setShowEdit(true);
  };

  const handleSaveEdit = async () => {
    if (!id) return;
    await updateVolunteer.mutateAsync({ id, ...editForm } as any);
    setShowEdit(false);
  };

  const handleLogHours = async () => {
    if (!id || !user?.id) return;
    const minutes = Math.round(parseFloat(shiftForm.hours) * 60);
    if (isNaN(minutes) || minutes <= 0) return;

    await createShift.mutateAsync({
      volunteer_id: id,
      kind: shiftForm.kind,
      event_id: shiftForm.kind === 'event' && shiftForm.event_id ? shiftForm.event_id : null,
      shift_date: shiftForm.shift_date,
      minutes,
      created_by: user.id,
    });
    setShowLogHours(false);
    setShiftForm({ shift_date: format(new Date(), 'yyyy-MM-dd'), hours: '1', kind: 'warehouse', event_id: '' });
  };

  if (isLoading) {
    return (
      <MainLayout title="Volunteer">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </MainLayout>
    );
  }

  if (!volunteer) {
    return (
      <MainLayout title="Volunteer">
        <div className="text-center py-12 text-muted-foreground">{t('detail.notFound')}</div>
      </MainLayout>
    );
  }

  const rel = getReliabilityLabel(volunteer.last_volunteered_at);

  return (
    <MainLayout title={`${volunteer.first_name} ${volunteer.last_name}`}>
      <div className="space-y-6">
        <Button variant="ghost" size="sm" onClick={() => navigate('/volunteers')}>
          <ArrowLeft className="w-4 h-4 mr-1" /> {t('detail.backToVolunteers')}
        </Button>

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">{volunteer.first_name} {volunteer.last_name}</h1>
            <p className="text-muted-foreground">{volunteer.email}</p>
            {id && <VolunteerTagSelector volunteerId={id} />}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={openEdit}>
              <Edit className="w-4 h-4 mr-2" /> {t('detail.edit')}
            </Button>
            <Button onClick={() => setShowLogHours(true)}>
              <Plus className="w-4 h-4 mr-2" /> {t('detail.logHours')}
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-4 pb-4">
              <p className="text-xs text-muted-foreground">{t('detail.lifetimeHours')}</p>
              <p className="text-2xl font-bold">{(volunteer.lifetime_minutes / 60).toFixed(1)}h</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4">
              <p className="text-xs text-muted-foreground">{t('detail.reliability')}</p>
              <p className={`text-lg font-medium ${rel.className}`}>{rel.label}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4">
              <p className="text-xs text-muted-foreground">{t('detail.status')}</p>
              <Badge variant={volunteer.status === 'active' ? 'default' : 'secondary'} className="mt-1">
                {volunteer.status}
              </Badge>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4">
              <p className="text-xs text-muted-foreground">{t('detail.totalShifts')}</p>
              <p className="text-2xl font-bold">{shifts?.length ?? 0}</p>
            </CardContent>
          </Card>
        </div>

        {/* Info */}
        {(volunteer.phone || volunteer.address || volunteer.notes) && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t('detail.detailsCard')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {volunteer.phone && <p><strong>{t('detail.phone')}:</strong> {volunteer.phone}</p>}
              {volunteer.address && (
                <p><strong>{t('detail.address')}:</strong> {[volunteer.address, volunteer.city, volunteer.state, volunteer.zip].filter(Boolean).join(', ')}</p>
              )}
              {volunteer.notes && <p><strong>{t('detail.notes')}:</strong> {volunteer.notes}</p>}
            </CardContent>
          </Card>
        )}

        {/* Personality & Identity */}
        <PersonalityStrengthsPanel
          entityType="volunteer"
          entityId={id!}
          showBio
          showAvailability
        />

        {/* Shift History */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="w-4 h-4" />
              {t('detail.shiftHistory')}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[400px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('detail.date')}</TableHead>
                    <TableHead>{t('detail.hours')}</TableHead>
                    <TableHead>{t('detail.location')}</TableHead>
                    <TableHead>{t('detail.source')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {shifts?.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                        {t('detail.noShiftsYet')}
                      </TableCell>
                    </TableRow>
                  ) : (
                    shifts?.map(s => (
                      <TableRow key={s.id}>
                        <TableCell>{format(new Date(s.shift_date), 'MMM d, yyyy')}</TableCell>
                        <TableCell>{(s.minutes / 60).toFixed(1)}h</TableCell>
                        <TableCell>
                          {s.kind === 'warehouse' ? (
                            <Badge variant="outline" className="gap-1">
                              <Warehouse className="w-3 h-3" /> {t('detail.warehouse')}
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="gap-1">
                              <Calendar className="w-3 h-3" />
                              {s.events?.event_name || t('detail.event')}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">{s.source}</Badge>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      {/* Edit Dialog */}
      <Dialog open={showEdit} onOpenChange={setShowEdit}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t('editDialog.title')}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div><Label>{t('editDialog.firstName')}</Label><Input value={editForm.first_name || ''} onChange={e => setEditForm(f => ({ ...f, first_name: e.target.value }))} /></div>
              <div><Label>{t('editDialog.lastName')}</Label><Input value={editForm.last_name || ''} onChange={e => setEditForm(f => ({ ...f, last_name: e.target.value }))} /></div>
            </div>
            <div><Label>{t('editDialog.email')}</Label><Input value={editForm.email || ''} onChange={e => setEditForm(f => ({ ...f, email: e.target.value }))} /></div>
            <div><Label>{t('editDialog.phone')}</Label><Input value={editForm.phone || ''} onChange={e => setEditForm(f => ({ ...f, phone: e.target.value }))} /></div>
            <div><Label>{t('editDialog.status')}</Label>
              <Select value={editForm.status} onValueChange={v => setEditForm(f => ({ ...f, status: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">{t('editDialog.active')}</SelectItem>
                  <SelectItem value="inactive">{t('editDialog.inactive')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label>{t('editDialog.notes')}</Label><Textarea value={editForm.notes || ''} onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))} /></div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowEdit(false)}>{t('editDialog.cancel')}</Button>
              <Button onClick={handleSaveEdit} disabled={updateVolunteer.isPending}>
                {updateVolunteer.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}{t('editDialog.save')}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Log Hours Dialog */}
      <Dialog open={showLogHours} onOpenChange={setShowLogHours}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t('logHoursDialog.title')}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>{t('logHoursDialog.date')}</Label><Input type="date" value={shiftForm.shift_date} onChange={e => setShiftForm(f => ({ ...f, shift_date: e.target.value }))} /></div>
            <div><Label>{t('logHoursDialog.hours')}</Label><Input type="number" step="0.5" min="0.5" max="24" value={shiftForm.hours} onChange={e => setShiftForm(f => ({ ...f, hours: e.target.value }))} /></div>
            <div><Label>{t('logHoursDialog.location')}</Label>
              <Select value={shiftForm.kind} onValueChange={v => setShiftForm(f => ({ ...f, kind: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="warehouse">{t('logHoursDialog.warehouse')}</SelectItem>
                  <SelectItem value="event">{t('logHoursDialog.event')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {shiftForm.kind === 'event' && (
              <div><Label>{t('logHoursDialog.event')}</Label>
                <Select value={shiftForm.event_id} onValueChange={v => setShiftForm(f => ({ ...f, event_id: v }))}>
                  <SelectTrigger><SelectValue placeholder={t('logHoursDialog.selectEvent')} /></SelectTrigger>
                  <SelectContent>
                    {events?.map(e => (
                      <SelectItem key={e.id} value={e.id}>{e.event_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowLogHours(false)}>{t('logHoursDialog.cancel')}</Button>
              <Button onClick={handleLogHours} disabled={createShift.isPending}>
                {createShift.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}{t('logHoursDialog.logHours')}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
