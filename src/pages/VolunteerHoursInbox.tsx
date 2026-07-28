import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, Inbox, Check, X, Eye } from 'lucide-react';
import { useVolunteerInbox, useUpdateInboxItem, useCreateShift, type VolunteerHoursInbox as InboxItem } from '@/hooks/useVolunteers';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { formatDistanceToNow, format } from 'date-fns';
import { toast } from '@/components/ui/sonner';

export default function VolunteerHoursInbox() {
  const { t } = useTranslation('volunteers');
  const [tab, setTab] = useState('needs_review');
  const [reviewItem, setReviewItem] = useState<InboxItem | null>(null);
  const { user } = useAuth();

  const { data: items, isLoading } = useVolunteerInbox(tab);
  const updateInbox = useUpdateInboxItem();
  const createShift = useCreateShift();

  // Load volunteers and events for manual resolution
  const { data: volunteers } = useQuery({
    queryKey: ['volunteers-lookup'],
    queryFn: async () => {
      const { data, error } = await supabase.from('volunteers').select('id, first_name, last_name, email').eq('status', 'active').order('first_name');
      if (error) throw error;
      return data;
    },
  });

  const { data: events } = useQuery({
    queryKey: ['events-lookup'],
    queryFn: async () => {
      const { data, error } = await supabase.from('events').select('id, event_name').order('event_name');
      if (error) throw error;
      return data;
    },
  });

  const [resolveForm, setResolveForm] = useState({
    volunteer_id: '',
    shift_date: '',
    hours: '',
    kind: 'warehouse',
    event_id: '',
  });

  const openReview = (item: InboxItem) => {
    setReviewItem(item);
    // Try to pre-fill from parsed_json
    const parsed = item.parsed_json as any;
    const matchedVol = volunteers?.find(v => v.email === item.from_email);
    setResolveForm({
      volunteer_id: parsed?.volunteer_id || matchedVol?.id || '',
      shift_date: parsed?.entries?.[0]?.date || format(new Date(item.received_at), 'yyyy-MM-dd'),
      hours: parsed?.entries?.[0]?.minutes ? String(parsed.entries[0].minutes / 60) : '1',
      kind: parsed?.entries?.[0]?.kind || 'warehouse',
      event_id: '',
    });
  };

  const handleApprove = async () => {
    if (!reviewItem || !resolveForm.volunteer_id || !resolveForm.shift_date || !resolveForm.hours || !user?.id) {
      toast.error(t('inbox.toast.fillRequired'));
      return;
    }
    const minutes = Math.round(parseFloat(resolveForm.hours) * 60);
    if (isNaN(minutes) || minutes <= 0) { toast.error(t('inbox.toast.invalidHours')); return; }

    await createShift.mutateAsync({
      volunteer_id: resolveForm.volunteer_id,
      kind: resolveForm.kind,
      event_id: resolveForm.kind === 'event' && resolveForm.event_id ? resolveForm.event_id : null,
      shift_date: resolveForm.shift_date,
      minutes,
      created_by: user.id,
    });

    await updateInbox.mutateAsync({ id: reviewItem.id, parse_status: 'parsed' });
    setReviewItem(null);
    toast.success(t('inbox.toast.approved'));
  };

  const handleReject = async () => {
    if (!reviewItem) return;
    await updateInbox.mutateAsync({ id: reviewItem.id, parse_status: 'rejected', reason: 'Manually rejected' });
    setReviewItem(null);
    toast.success(t('inbox.toast.rejected'));
  };

  return (
    <MainLayout title={t('inbox.title')}>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Inbox className="w-6 h-6" />
            {t('inbox.title')}
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            {t('inbox.subtitle')}
          </p>
        </div>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="needs_review">{t('inbox.tabNeedsReview')}</TabsTrigger>
            <TabsTrigger value="parsed">{t('inbox.tabParsed')}</TabsTrigger>
            <TabsTrigger value="rejected">{t('inbox.tabRejected')}</TabsTrigger>
          </TabsList>

          <TabsContent value={tab}>
            <Card>
              <CardContent className="p-0">
                {isLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-6 h-6 animate-spin text-primary" />
                  </div>
                ) : (
                  <ScrollArea className="h-[500px]">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>{t('inbox.colFrom')}</TableHead>
                          <TableHead>{t('inbox.colSubject')}</TableHead>
                          <TableHead>{t('inbox.colReceived')}</TableHead>
                          <TableHead>{t('inbox.colReason')}</TableHead>
                          <TableHead className="text-right">{t('inbox.colActions')}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {items?.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                              {t('inbox.noItems')}
                            </TableCell>
                          </TableRow>
                        ) : (
                          items?.map(item => (
                            <TableRow key={item.id}>
                              <TableCell className="font-medium">{item.from_email}</TableCell>
                              <TableCell className="max-w-[200px] truncate">{item.subject || '—'}</TableCell>
                              <TableCell>
                                {formatDistanceToNow(new Date(item.received_at), { addSuffix: true })}
                              </TableCell>
                              <TableCell className="max-w-[200px] truncate text-muted-foreground text-sm">
                                {item.reason || '—'}
                              </TableCell>
                              <TableCell className="text-right">
                                <Button variant="ghost" size="sm" onClick={() => openReview(item)}>
                                  <Eye className="w-4 h-4" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Review Dialog */}
      <Dialog open={!!reviewItem} onOpenChange={open => !open && setReviewItem(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{t('inbox.reviewDialog.title')}</DialogTitle></DialogHeader>
          {reviewItem && (
            <div className="space-y-4">
              <div className="bg-muted p-3 rounded text-sm space-y-1">
                <p><strong>{t('inbox.reviewDialog.from')}:</strong> {reviewItem.from_email}</p>
                <p><strong>{t('inbox.reviewDialog.subject')}:</strong> {reviewItem.subject || '—'}</p>
                <p><strong>{t('inbox.reviewDialog.reason')}:</strong> {reviewItem.reason || '—'}</p>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">{t('inbox.reviewDialog.rawText')}</Label>
                <pre className="text-xs bg-muted p-2 rounded max-h-32 overflow-auto whitespace-pre-wrap">
                  {reviewItem.raw_text}
                </pre>
              </div>

              {tab === 'needs_review' && (
                <>
                  <div>
                    <Label>{t('inbox.reviewDialog.volunteer')}</Label>
                    <Select value={resolveForm.volunteer_id} onValueChange={v => setResolveForm(f => ({ ...f, volunteer_id: v }))}>
                      <SelectTrigger><SelectValue placeholder={t('inbox.reviewDialog.selectVolunteer')} /></SelectTrigger>
                      <SelectContent>
                        {volunteers?.map(v => (
                          <SelectItem key={v.id} value={v.id}>{v.first_name} {v.last_name} ({v.email})</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><Label>{t('inbox.reviewDialog.date')}</Label><Input type="date" value={resolveForm.shift_date} onChange={e => setResolveForm(f => ({ ...f, shift_date: e.target.value }))} /></div>
                    <div><Label>{t('inbox.reviewDialog.hours')}</Label><Input type="number" step="0.5" value={resolveForm.hours} onChange={e => setResolveForm(f => ({ ...f, hours: e.target.value }))} /></div>
                  </div>
                  <div>
                    <Label>{t('inbox.reviewDialog.location')}</Label>
                    <Select value={resolveForm.kind} onValueChange={v => setResolveForm(f => ({ ...f, kind: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="warehouse">{t('inbox.reviewDialog.warehouse')}</SelectItem>
                        <SelectItem value="event">{t('inbox.reviewDialog.event')}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {resolveForm.kind === 'event' && (
                    <div>
                      <Label>{t('inbox.reviewDialog.event')}</Label>
                      <Select value={resolveForm.event_id} onValueChange={v => setResolveForm(f => ({ ...f, event_id: v }))}>
                        <SelectTrigger><SelectValue placeholder={t('inbox.reviewDialog.selectEvent')} /></SelectTrigger>
                        <SelectContent>
                          {events?.map(e => <SelectItem key={e.id} value={e.id}>{e.event_name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  <div className="flex justify-end gap-2">
                    <Button variant="destructive" size="sm" onClick={handleReject} disabled={updateInbox.isPending}>
                      <X className="w-4 h-4 mr-1" /> {t('inbox.reviewDialog.reject')}
                    </Button>
                    <Button size="sm" onClick={handleApprove} disabled={createShift.isPending}>
                      <Check className="w-4 h-4 mr-1" /> {t('inbox.reviewDialog.approveAndLog')}
                    </Button>
                  </div>
                </>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
