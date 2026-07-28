import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Loader2, Plus, Search, Users, Copy, Info } from 'lucide-react';
import { useVolunteers, useCreateVolunteer, getReliabilityLabel } from '@/hooks/useVolunteers';
import { useVolunteerTags } from '@/hooks/useVolunteerTags';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { formatDistanceToNow } from 'date-fns';
import { toast } from '@/components/ui/sonner';
import { useTenantNavigate } from '@/hooks/useTenantPath';
import { FirstActionEmptyState } from '@/components/ui/first-action-empty-state';

const HOURS_TEMPLATE = 'HOURS: YYYY-MM-DD | 3.5 | warehouse\nHOURS: YYYY-MM-DD | 2 | event: Community Fair';

export default function Volunteers() {
  const { t } = useTranslation('volunteers');
  const navigate = useTenantNavigate();
  const { user } = useAuth();
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({
    first_name: '', last_name: '', email: '', phone: '', notes: '',
  });

  const { data: volunteers, isLoading } = useVolunteers(statusFilter);
  const createVolunteer = useCreateVolunteer();
  const { data: allTags = [] } = useVolunteerTags();

  // Fetch all tag links for display
  const { data: allTagLinks = [] } = useQuery({
    queryKey: ['volunteer-tag-links-all'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('volunteer_tag_links')
        .select('volunteer_id, tag_id');
      if (error) throw error;
      return data as { volunteer_id: string; tag_id: string }[];
    },
  });

  const filtered = volunteers?.filter(v => {
    const q = search.toLowerCase();
    return !q || `${v.first_name} ${v.last_name}`.toLowerCase().includes(q) || v.email.toLowerCase().includes(q);
  });

  const handleCreate = async () => {
    if (!form.first_name || !form.last_name || !form.email) {
      toast.error(t('toast.nameEmailRequired'));
      return;
    }
    await createVolunteer.mutateAsync(form);
    setShowCreate(false);
    setForm({ first_name: '', last_name: '', email: '', phone: '', notes: '' });
  };

  const copyTemplate = () => {
    navigator.clipboard.writeText(HOURS_TEMPLATE);
    toast.success(t('toast.templateCopied'));
  };

  return (
    <MainLayout title={t('page.title')} data-testid="volunteers-root">
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Users className="w-6 h-6" />
              {t('page.title')}
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              {t('page.subtitle')}
            </p>
          </div>
          <Button onClick={() => setShowCreate(true)}>
            <Plus className="w-4 h-4 mr-2" />
            {t('createDialog.title')}
          </Button>
        </div>

        {/* How to submit hours */}
        <Card className="border-dashed">
          <CardContent className="py-4">
            <div className="flex items-start gap-3">
              <Info className="w-5 h-5 text-muted-foreground mt-0.5 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">{t('page.hoursInstructions.title')}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {t('page.hoursInstructions.subtitle')}
                </p>
                <pre className="text-xs bg-muted p-2 rounded mt-2 overflow-x-auto">
                  {HOURS_TEMPLATE}
                </pre>
              </div>
              <Button variant="outline" size="sm" onClick={copyTemplate}>
                <Copy className="w-3 h-3 mr-1" />
                {t('page.copy')}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Filters */}
        <div className="flex gap-3">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder={t('page.searchPlaceholder')}
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('page.filterAll')}</SelectItem>
              <SelectItem value="active">{t('page.filterActive')}</SelectItem>
              <SelectItem value="inactive">{t('page.filterInactive')}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Table */}
        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
            ) : (
              <ScrollArea className="h-[600px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('table.name')}</TableHead>
                      <TableHead>{t('table.tags')}</TableHead>
                      <TableHead>{t('table.email')}</TableHead>
                      <TableHead>{t('table.lastVolunteered')}</TableHead>
                      <TableHead className="text-right">{t('table.lifetimeHours')}</TableHead>
                      <TableHead>{t('table.reliability')}</TableHead>
                      <TableHead>{t('table.status')}</TableHead>
                      <TableHead>{t('table.reliability')}</TableHead>
                      <TableHead>{t('table.status')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered?.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="py-0">
                          <FirstActionEmptyState
                            icon={Users}
                            title={t('page.noVolunteersFound')}
                            context={t('page.emptyContext', 'Add your first volunteer to start tracking hours and reliability.')}
                            actionLabel={t('page.addVolunteer', 'Add volunteer')}
                            onAction={() => setShowCreate(true)}
                          />
                        </TableCell>
                      </TableRow>
                    ) : (
                      filtered?.map(v => {
                        const rel = getReliabilityLabel(v.last_volunteered_at);
                        return (
                          <TableRow
                            key={v.id}
                            className="cursor-pointer hover:bg-muted/50"
                            onClick={() => navigate(`/volunteers/${v.id}`)}
                          >
                            <TableCell className="font-medium">
                              {v.first_name} {v.last_name}
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-wrap gap-1">
                                {allTagLinks
                                  .filter(l => l.volunteer_id === v.id)
                                  .map(l => {
                                    const tag = allTags.find(t => t.id === l.tag_id);
                                    if (!tag) return null;
                                    return (
                                      <Badge
                                        key={tag.id}
                                        variant="outline"
                                        className="text-[10px] px-1.5 py-0"
                                        style={{ borderColor: tag.color, color: tag.color }}
                                      >
                                        {tag.name}
                                      </Badge>
                                    );
                                  })}
                              </div>
                            </TableCell>
                            <TableCell className="text-muted-foreground">{v.email}</TableCell>
                            <TableCell>
                              {v.last_volunteered_at ? (
                                <Tooltip>
                                  <TooltipTrigger>
                                    {formatDistanceToNow(new Date(v.last_volunteered_at), { addSuffix: true })}
                                  </TooltipTrigger>
                                  <TooltipContent>{new Date(v.last_volunteered_at).toLocaleDateString()}</TooltipContent>
                                </Tooltip>
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </TableCell>
                            <TableCell className="text-right font-medium">
                              {(v.lifetime_minutes / 60).toFixed(1)}h
                            </TableCell>
                            <TableCell>
                              <span className={`text-sm ${rel.className}`}>{rel.label}</span>
                            </TableCell>
                            <TableCell>
                              <Badge variant={v.status === 'active' ? 'default' : 'secondary'}>
                                {v.status}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Create Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('createDialog.title')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>{t('createDialog.firstNameLabel')}</Label>
                <Input value={form.first_name} onChange={e => setForm(f => ({ ...f, first_name: e.target.value }))} />
              </div>
              <div>
                <Label>{t('createDialog.lastNameLabel')}</Label>
                <Input value={form.last_name} onChange={e => setForm(f => ({ ...f, last_name: e.target.value }))} />
              </div>
            </div>
            <div>
              <Label>{t('createDialog.emailLabel')}</Label>
              <Input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
            </div>
            <div>
              <Label>{t('createDialog.phoneLabel')}</Label>
              <Input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
            </div>
            <div>
              <Label>{t('createDialog.notesLabel')}</Label>
              <Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowCreate(false)}>{t('createDialog.cancel')}</Button>
              <Button onClick={handleCreate} disabled={createVolunteer.isPending}>
                {createVolunteer.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {t('createDialog.create')}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
