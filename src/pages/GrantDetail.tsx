import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { useParams, useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { MainLayout } from '@/components/layout/MainLayout';
import { useGrant, useUpdateGrant } from '@/hooks/useGrants';
import { useGrantActivities, useCreateGrantActivity, GrantActivityType } from '@/hooks/useGrantActivities';
import { useDuplicateGrant } from '@/hooks/useDuplicateGrant';
import { useDeleteWithUndo } from '@/hooks/useDeleteWithUndo';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  ArrowLeft,
  Pencil,
  Trash2,
  Copy,
  MapPin,
  Calendar,
  DollarSign,
  FileText,
  Clock,
  Link2,
  ExternalLink,
  Loader2,
  Sparkles,
  Check,
  X,
} from 'lucide-react';
import { GrantStageBadge } from '@/components/grants/GrantStageBadge';
import { StarRatingControl } from '@/components/grants/StarRatingControl';
import { GrantActivityTimeline } from '@/components/grants/GrantActivityTimeline';
import { LinkedAnchorsPanel } from '@/components/grants/LinkedAnchorsPanel';
import { GrantModal } from '@/components/modals/GrantModal';
import { SuggestedContactsPanel } from '@/components/contact-suggestions/SuggestedContactsPanel';
import { GrantResourcesPanel } from '@/components/grants/GrantResourcesPanel';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/components/ui/sonner';

const ACTIVITY_TYPES: GrantActivityType[] = [
  'Research',
  'Call',
  'Meeting',
  'Writing',
  'Submission',
  'Reporting'
];

export default function GrantDetail() {
  const { t } = useTranslation('grants');
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, hasAnyRole } = useAuth();
  const { data: grant, isLoading } = useGrant(id || null);
  const { data: activities } = useGrantActivities(id || null);
  const { deleteRecord, isDeleting } = useDeleteWithUndo();
  const createActivity = useCreateGrantActivity();
  const duplicateGrant = useDuplicateGrant();
  const updateGrant = useUpdateGrant();
  const [editingUrl, setEditingUrl] = useState<'source_url' | 'application_url' | null>(null);
  const [urlDraft, setUrlDraft] = useState('');

  const queryClient = useQueryClient();
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isAddActivityOpen, setIsAddActivityOpen] = useState(false);
  const [isEnriching, setIsEnriching] = useState(false);
  const [searchUrls, setSearchUrls] = useState<{ name: string; url: string }[]>([]);
  const [showSearchUrls, setShowSearchUrls] = useState(false);
  const [activityForm, setActivityForm] = useState({
    activity_type: 'Research' as GrantActivityType,
    activity_date: new Date().toISOString().split('T')[0],
    notes: '',
    next_action: '',
    next_action_due: ''
  });

  const canViewStrategyNotes = hasAnyRole(['admin', 'leadership']);

  const handleDuplicate = async () => {
    if (grant) {
      const newGrant = await duplicateGrant.mutateAsync(grant);
      if (newGrant) {
        navigate(`/grants/${newGrant.id}`);
      }
    }
  };

  const handleDelete = async () => {
    if (id) {
      await deleteRecord(id, 'grant');
      setIsDeleteDialogOpen(false);
      navigate('/grants');
    }
  };

  const handleAddActivity = async () => {
    if (!id || !user) return;
    await createActivity.mutateAsync({
      grant_id: id,
      activity_type: activityForm.activity_type,
      activity_date: new Date(activityForm.activity_date).toISOString(),
      notes: activityForm.notes || null,
      next_action: activityForm.next_action || null,
      next_action_due: activityForm.next_action_due ? new Date(activityForm.next_action_due).toISOString() : null,
      owner_id: user.id
    });
    setActivityForm({
      activity_type: 'Research',
      activity_date: new Date().toISOString().split('T')[0],
      notes: '',
      next_action: '',
      next_action_due: ''
    });
    setIsAddActivityOpen(false);
  };

  const formatCurrency = (amount: number | null) => {
    if (!amount) return '—';
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(amount);
  };

  if (isLoading) {
    return (
      <MainLayout title={t('detail.loading')} subtitle="">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </MainLayout>
    );
  }

  if (!grant) {
    return (
      <MainLayout title={t('detail.notFound')} subtitle={t('detail.notFoundSubtitle')}>
        <div className="text-center py-12">
          <p className="text-muted-foreground mb-4">{t('detail.notFoundMessage')}</p>
          <Button onClick={() => navigate('/grants')}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            {t('detail.backToGrants')}
          </Button>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout title={grant.grant_name} subtitle={grant.funder_name}>
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header Actions */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate('/grants')}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            {t('detail.backToGrants')}
          </Button>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={isEnriching}
              onClick={async () => {
                setIsEnriching(true);
                try {
                  let sourceUrl = grant.source_url;

                  // Step 1: Get pre-filled search URLs (no Perplexity)
                  toast.info(sourceUrl ? t('toasts.extractingDetails') : t('toasts.searchingUrl'));
                  const { data: findData, error: findErr } = await supabase.functions.invoke('grant-find-url', {
                    body: {
                      grant_id: grant.id,
                      grant_name: grant.grant_name,
                      funder_name: grant.funder_name,
                    },
                  });
                  if (findErr) {
                    console.error('grant-find-url error:', findErr);
                  } else if (findData?.search_urls?.length) {
                    setSearchUrls(findData.search_urls);
                    setShowSearchUrls(true);
                    return;
                  } else if (findData?.found && findData?.url) {
                    sourceUrl = findData.url;
                    toast.success(t('toasts.foundUrl', { title: findData.title || sourceUrl }));
                    queryClient.invalidateQueries({ queryKey: ['grant', grant.id] });
                  } else if (!sourceUrl) {
                    toast.error(t('toasts.noUrlFound'));
                    return;
                  }

                  // Step 2: Enqueue enrichment with the URL
                  const { data, error } = await supabase.functions.invoke('enrichment-job-enqueue', {
                    body: {
                      entity_type: 'grant',
                      entity_id: grant.id,
                      source_url: sourceUrl,
                    },
                  });
                  if (error) throw error;

                  // Step 3: Dispatch to n8n grant enrichment workflow
                  const { error: dispatchErr } = await supabase.functions.invoke('n8n-dispatch', {
                    body: {
                      workflow_key: 'grant_enrich',
                      grant_id: grant.id,
                      source_url: sourceUrl,
                      grant_name: grant.grant_name,
                      funder_name: grant.funder_name,
                    },
                  });
                  if (dispatchErr) {
                    console.error('grant_enrich dispatch error:', dispatchErr);
                  }

                  if (data?.ok) {
                    toast.success(data.duplicate
                      ? t('toasts.enrichmentInProgress')
                      : t('toasts.enrichmentStarted'));
                  }
                } catch (err) {
                  toast.error(err instanceof Error ? err.message : t('toasts.enrichmentFailed'));
                } finally {
                  setIsEnriching(false);
                  queryClient.invalidateQueries({ queryKey: ['grant', grant.id] });
                  queryClient.invalidateQueries({ queryKey: ['grant-resources', grant.id] });
                }
              }}
            >
              {isEnriching ? (
                <Loader2 className="w-4 h-4 animate-spin mr-1" />
              ) : (
                <Sparkles className="w-4 h-4 mr-1" />
              )}
              <span className="hidden sm:inline">{t('detail.enrich')}</span>
            </Button>
            <Button variant="outline" size="sm" onClick={handleDuplicate} disabled={duplicateGrant.isPending}>
              <Copy className="w-4 h-4 mr-1" />
              <span className="hidden sm:inline">{t('detail.duplicate')}</span>
            </Button>
            <Button variant="outline" size="sm" onClick={() => setIsEditModalOpen(true)}>
              <Pencil className="w-4 h-4 mr-1" />
              <span className="hidden sm:inline">{t('detail.edit')}</span>
            </Button>
            <Button variant="outline" size="sm" className="text-destructive" onClick={() => setIsDeleteDialogOpen(true)}>
              <Trash2 className="w-4 h-4 mr-1" />
              <span className="hidden sm:inline">{t('detail.delete')}</span>
            </Button>
          </div>
        </div>

        {/* Status Bar */}
        <div className="flex flex-wrap items-center gap-3">
          <div data-tour="grant-stage-badge"><GrantStageBadge stage={grant.stage} /></div>
          <Badge variant={grant.status === 'Active' ? 'default' : 'secondary'}>
            {grant.status}
          </Badge>
          <Badge variant="outline">{grant.funder_type}</Badge>
          <div className="ml-auto">
            <div data-tour="grant-star-rating"><StarRatingControl value={grant.star_rating} readonly size="md" /></div>
          </div>
        </div>

        {/* Relationships & Source */}
        <Card>
          <CardContent className="pt-6 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">{t('detail.metro')}</span>
                <span className="text-sm font-medium">{grant.metros?.metro || '—'}</span>
              </div>
              <div className="flex items-center gap-2">
                <Link2 className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">{t('detail.opportunity')}</span>
                <span className="text-sm font-medium">{grant.opportunities?.organization || '—'}</span>
              </div>
            </div>
            {/* Editable Source URL */}
            <div className="flex items-center gap-2 group">
              <ExternalLink className="w-4 h-4 text-muted-foreground shrink-0" />
              <span className="text-sm text-muted-foreground">{t('detail.source')}</span>
              {editingUrl === 'source_url' ? (
                <div className="flex items-center gap-1 flex-1 min-w-0">
                  <Input
                    value={urlDraft}
                    onChange={(e) => setUrlDraft(e.target.value)}
                    placeholder="https://..."
                    className="h-7 text-sm flex-1"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        updateGrant.mutate({ id: grant.id, source_url: urlDraft || null });
                        setEditingUrl(null);
                      }
                      if (e.key === 'Escape') setEditingUrl(null);
                    }}
                  />
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => {
                    updateGrant.mutate({ id: grant.id, source_url: urlDraft || null });
                    setEditingUrl(null);
                  }}><Check className="w-3.5 h-3.5" /></Button>
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditingUrl(null)}>
                    <X className="w-3.5 h-3.5" />
                  </Button>
                </div>
              ) : (
                <>
                  {grant.source_url ? (
                    <a href={grant.source_url} target="_blank" rel="noopener noreferrer"
                      className="text-sm font-medium text-primary hover:underline truncate">
                      {grant.source_url}
                    </a>
                  ) : (
                    <span className="text-sm text-muted-foreground italic">{t('detail.noUrl')}</span>
                  )}
                  <Button size="icon" variant="ghost"
                    className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => { setEditingUrl('source_url'); setUrlDraft(grant.source_url || ''); }}>
                    <Pencil className="w-3 h-3" />
                  </Button>
                </>
              )}
            </div>
            {/* Editable Application URL */}
            <div className="flex items-center gap-2 group">
              <ExternalLink className="w-4 h-4 text-muted-foreground shrink-0" />
              <span className="text-sm text-muted-foreground">{t('detail.apply')}</span>
              {editingUrl === 'application_url' ? (
                <div className="flex items-center gap-1 flex-1 min-w-0">
                  <Input
                    value={urlDraft}
                    onChange={(e) => setUrlDraft(e.target.value)}
                    placeholder="https://..."
                    className="h-7 text-sm flex-1"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        updateGrant.mutate({ id: grant.id, application_url: urlDraft || null });
                        setEditingUrl(null);
                      }
                      if (e.key === 'Escape') setEditingUrl(null);
                    }}
                  />
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => {
                    updateGrant.mutate({ id: grant.id, application_url: urlDraft || null });
                    setEditingUrl(null);
                  }}><Check className="w-3.5 h-3.5" /></Button>
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditingUrl(null)}>
                    <X className="w-3.5 h-3.5" />
                  </Button>
                </div>
              ) : (
                <>
                  {grant.application_url ? (
                    <a href={grant.application_url} target="_blank" rel="noopener noreferrer"
                      className="text-sm font-medium text-primary hover:underline truncate">
                      {grant.application_url}
                    </a>
                  ) : (
                    <span className="text-sm text-muted-foreground italic">{t('detail.noUrl')}</span>
                  )}
                  <Button size="icon" variant="ghost"
                    className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => { setEditingUrl('application_url'); setUrlDraft(grant.application_url || ''); }}>
                    <Pencil className="w-3 h-3" />
                  </Button>
                </>
              )}
            </div>
            <div className="grid grid-cols-2 gap-4 text-sm pt-2 border-t">
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">{t('detail.matchRequired')}</span>
                <span className={grant.match_required ? 'text-warning font-medium' : ''}>
                  {grant.match_required ? t('detail.yes') : t('detail.no')}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">{t('detail.reporting')}</span>
                <span>
                  {grant.reporting_required
                    ? grant.reporting_frequency || 'Required'
                    : t('detail.notRequired')}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Funding */}
        <Card>
          <CardContent className="pt-6">
            <h4 className="font-medium mb-3 flex items-center gap-2">
              <DollarSign className="w-4 h-4" />
              {t('detail.funding')}
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div>
                <p className="text-xs text-muted-foreground">{t('detail.available')}</p>
                <p className="text-lg font-semibold text-primary">{formatCurrency(grant.available_funding)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{t('detail.requested')}</p>
                <p className="text-lg font-semibold">{formatCurrency(grant.amount_requested)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{t('detail.awarded')}</p>
                <p className="text-lg font-semibold text-success">{formatCurrency(grant.amount_awarded)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{t('detail.fiscalYear')}</p>
                <p className="text-lg font-semibold">{grant.fiscal_year || '—'}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Grant Term */}
        <Card>
          <CardContent className="pt-6">
            <h4 className="font-medium mb-3 flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              {t('detail.grantTerm')}
            </h4>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <p className="text-xs text-muted-foreground">{t('detail.startDate')}</p>
                <p className="font-medium">
                  {grant.grant_term_start ? format(new Date(grant.grant_term_start), 'MMM d, yyyy') : '—'}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{t('detail.endDate')}</p>
                <p className="font-medium">
                  {grant.grant_term_end ? format(new Date(grant.grant_term_end), 'MMM d, yyyy') : '—'}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{t('detail.multiYear')}</p>
                <p className="font-medium">{grant.is_multiyear ? t('detail.yes') : t('detail.no')}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Resources & Downloads */}
        <GrantResourcesPanel grantId={grant.id} />

        {/* Tags */}
        {(grant.grant_types?.length > 0 || grant.strategic_focus?.length > 0) && (
          <Card>
            <CardContent className="pt-6 space-y-3">
              {grant.grant_types?.length > 0 && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">{t('detail.grantTypes')}</p>
                  <div className="flex flex-wrap gap-1">
                    {grant.grant_types.map(type => (
                      <Badge key={type} variant="outline">{type}</Badge>
                    ))}
                  </div>
                </div>
              )}
              {grant.strategic_focus?.length > 0 && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">{t('detail.strategicFocus')}</p>
                  <div className="flex flex-wrap gap-1">
                    {grant.strategic_focus.map(focus => (
                      <Badge key={focus} variant="secondary">{focus}</Badge>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Notes */}
        {grant.notes && (
          <Card>
            <CardContent className="pt-6">
              <h4 className="font-medium mb-2 flex items-center gap-2">
                <FileText className="w-4 h-4" />
                {t('detail.notes')}
              </h4>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">{grant.notes}</p>
            </CardContent>
          </Card>
        )}

        {/* Internal Strategy Notes */}
        {canViewStrategyNotes && grant.internal_strategy_notes && (
          <div className="border border-warning/30 bg-warning/5 rounded-lg p-4">
            <h4 className="font-medium mb-2 flex items-center gap-2 text-warning">
              <FileText className="w-4 h-4" />
              {t('detail.internalStrategyNotes')}
            </h4>
            <p className="text-sm whitespace-pre-wrap">{grant.internal_strategy_notes}</p>
          </div>
        )}

        <Separator />

        {/* Suggested Contacts */}
        <SuggestedContactsPanel entityType="grant" entityId={grant.id} />

        <Separator />

        {/* Linked Anchors */}
        <LinkedAnchorsPanel grantId={grant.id} grantName={grant.grant_name} />

        <Separator />

        {/* Activities */}
        <div>
          <h3 className="font-semibold text-lg mb-4">{t('detail.activities', { count: activities?.length || 0 })}</h3>
          {isAddActivityOpen ? (
            <Card>
              <CardContent className="pt-6 space-y-4">
                <h4 className="font-medium">{t('detail.logActivity')}</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>{t('detail.activityType')}</Label>
                    <Select
                      value={activityForm.activity_type}
                      onValueChange={(v) => setActivityForm(prev => ({ ...prev, activity_type: v as GrantActivityType }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ACTIVITY_TYPES.map(type => (
                          <SelectItem key={type} value={type}>{type}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>{t('detail.date')}</Label>
                    <Input
                      type="date"
                      value={activityForm.activity_date}
                      onChange={(e) => setActivityForm(prev => ({ ...prev, activity_date: e.target.value }))}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>{t('detail.notesLabel')}</Label>
                  <Textarea
                    value={activityForm.notes}
                    onChange={(e) => setActivityForm(prev => ({ ...prev, notes: e.target.value }))}
                    placeholder={t('detail.notesPlaceholder')}
                    rows={2}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>{t('detail.nextAction')}</Label>
                    <Input
                      value={activityForm.next_action}
                      onChange={(e) => setActivityForm(prev => ({ ...prev, next_action: e.target.value }))}
                      placeholder={t('detail.nextActionPlaceholder')}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{t('detail.dueDate')}</Label>
                    <Input
                      type="date"
                      value={activityForm.next_action_due}
                      onChange={(e) => setActivityForm(prev => ({ ...prev, next_action_due: e.target.value }))}
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button onClick={handleAddActivity} disabled={createActivity.isPending}>
                    {t('detail.saveActivity')}
                  </Button>
                  <Button variant="outline" onClick={() => setIsAddActivityOpen(false)}>
                    {t('detail.cancel')}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div data-tour="grant-timeline">
              <GrantActivityTimeline
                activities={activities || []}
                onAddActivity={() => setIsAddActivityOpen(true)}
              />
            </div>
          )}
        </div>

        {/* Metadata */}
        <div className="flex items-center gap-4 text-xs text-muted-foreground pt-4 border-t">
          <div className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {t('detail.created', { date: format(new Date(grant.created_at), 'MMM d, yyyy') })}
          </div>
          <div className="flex items-center gap-1">
            {t('detail.stageSince', { date: format(new Date(grant.stage_entry_date), 'MMM d, yyyy') })}
          </div>
        </div>
      </div>

      {/* Delete Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('deleteDialog.title')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('deleteDialog.description')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>{t('deleteDialog.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={isDeleting}
            >
              {isDeleting ? t('deleteDialog.deleting') : t('deleteDialog.confirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Search URLs Dialog */}
      <Dialog open={showSearchUrls} onOpenChange={setShowSearchUrls}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Search for this grant</DialogTitle>
            <DialogDescription>
              Browse these sources to locate the official grant page. Paste the URL into the source field when you find it.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            {searchUrls.map((s) => (
              <a
                key={s.name}
                href={s.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 rounded-lg border p-3 text-sm hover:bg-accent transition-colors"
              >
                <ExternalLink className="w-4 h-4 text-muted-foreground shrink-0" />
                <span className="font-medium">{s.name}</span>
                <span className="ml-auto text-xs text-muted-foreground truncate max-w-[200px]">
                  {s.url}
                </span>
              </a>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSearchUrls(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Modal */}
      <GrantModal
        open={isEditModalOpen}
        onOpenChange={setIsEditModalOpen}
        grant={grant}
      />
    </MainLayout>
  );
}
