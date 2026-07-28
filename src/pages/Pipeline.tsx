import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { MainLayout } from '@/components/layout/MainLayout';
import { useAnchorPipeline, useConvertPipelineToAnchor } from '@/hooks/useAnchorPipeline';
import { useOpportunities, useUpdateOpportunity } from '@/hooks/useOpportunities';
import { cn } from '@/lib/utils';
import { isDemoProxyActive } from '@/lib/demoWriteProxy';
import { toast } from 'sonner';
import { 
  Search, 
  Clock,
  Target,
  Calendar,
  User,
  ChevronRight,
  AlertTriangle,
  Anchor,
  Loader2,
  ArrowRightLeft
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
import { parseISO } from 'date-fns';
import {
  toChapterLabel,
  JOURNEY_KANBAN_CHAPTERS,
  CHAPTER_COLORS,
  CHAPTER_BADGE_CLASS,
  Chapter,
} from '@/lib/journeyChapters';

export default function Pipeline() {
  const [searchQuery, setSearchQuery] = useState('');
  const [convertDialogOpen, setConvertDialogOpen] = useState(false);
  const [selectedPipelineId, setSelectedPipelineId] = useState<string | null>(null);
  const [selectedOrg, setSelectedOrg] = useState<string>('');
  const navigate = useNavigate();

  const { t } = useTranslation('relationships');

  const { data: pipeline, isLoading: pipelineLoading } = useAnchorPipeline();
  const { data: opportunities, isLoading: oppsLoading } = useOpportunities();
  const convertMutation = useConvertPipelineToAnchor();
  const updateOpportunity = useUpdateOpportunity();

  /** Reverse map from canonical chapter to a legacy DB stage value */
  const chapterToLegacyStage: Record<Chapter, string> = {
    'Found': 'Target Identified',
    'First Conversation': 'Contacted',
    'Discovery': 'Discovery Held',
    'Pricing Shared': 'Proposal Sent',
    'Account Setup': 'Agreement Pending',
    'First Devices': 'First Volume',
    'Growing Together': 'Stable Producer',
    'Not the Right Time': 'Closed - Not a Fit',
  };

  /** Move a card to a different journey chapter */
  const handleMoveToChapter = (item: any, targetChapter: Chapter) => {
    if (isDemoProxyActive()) {
      toast.info('Demo mode — stage change not saved');
      return;
    }
    const oppId = item.opportunity_id || item.id;
    if (!oppId) return;
    const legacyStage = chapterToLegacyStage[targetChapter];
    updateOpportunity.mutate({ id: oppId, stage: legacyStage as any });
  };

  const isLoading = pipelineLoading || oppsLoading;

  // Build unified items: early-stage opportunities + anchor_pipeline records
  const unifiedItems = useMemo(() => {
    const pipelineItems = (pipeline || []).map(item => ({
      ...item,
      _source: 'pipeline' as const,
    }));

    // IDs already covered by anchor_pipeline records
    const pipelineOppIds = new Set(pipelineItems.map(p => p.opportunity_id).filter(Boolean));

    // Include ALL active opportunities that don't already have an anchor_pipeline record
    const oppsWithoutPipeline = (opportunities || [])
      .filter(o => o.status === 'Active' && !pipelineOppIds.has(o.id))
      .map(o => ({
        id: o.id,
        anchor_pipeline_id: `opp-${o.id}`,
        opportunity_id: o.id,
        metro_id: o.metro_id || null,
        owner: null,
        stage: o.stage || null,
        stage_entry_date: o.created_at || null,
        last_activity_date: null,
        next_action: o.next_step || null,
        next_action_due: null,
        expected_anchor_yn: null,
        probability: null as number | null,
        estimated_monthly_volume: null as number | null,
        target_first_volume_date: null,
        notes: null,
        created_at: o.created_at || null,
        updated_at: o.updated_at || null,
        organization: o.organization,
        metro: o.metros?.metro || null,
        daysInStage: o.created_at
          ? Math.floor((Date.now() - new Date(o.created_at).getTime()) / (1000 * 60 * 60 * 24))
          : 0,
        _source: 'opportunity' as const,
      }));

    return [...oppsWithoutPipeline, ...pipelineItems];
  }, [pipeline, opportunities]);

  const filteredItems = unifiedItems.filter(item =>
    item.organization?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.metro?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Group items by chapter (mapping legacy stage values)
  const journeyByChapter = JOURNEY_KANBAN_CHAPTERS.map(chapter => ({
    chapter,
    items: filteredItems.filter(item => toChapterLabel(item.stage) === chapter)
  }));

  const getChapterColor = (chapter: Chapter) => CHAPTER_COLORS[chapter];
  const getChapterBadgeClass = (chapter: Chapter) => CHAPTER_BADGE_CLASS[chapter];

  const handleConvertClick = (id: string, organization: string) => {
    setSelectedPipelineId(id);
    setSelectedOrg(organization);
    setConvertDialogOpen(true);
  };

  const handleConfirmConvert = () => {
    if (selectedPipelineId) {
      convertMutation.mutate(selectedPipelineId, {
        onSuccess: () => {
          setConvertDialogOpen(false);
          setSelectedPipelineId(null);
          setSelectedOrg('');
        }
      });
    }
  };

  if (isLoading) {
    return (
      <MainLayout
        title={t('pipeline.title')}
        subtitle={t('pipeline.subtitle')}
        helpKey="page.journey"
        data-testid="pipeline-root"
      >
        <div className="space-y-6">
          <div className="flex gap-4">
            <Skeleton className="h-10 w-64" />
            <Skeleton className="h-10 w-32" />
          </div>
          <div className="flex gap-4 overflow-x-auto">
            {[1, 2, 3, 4, 5, 6, 7].map(i => (
              <Skeleton key={i} className="h-[500px] w-80 flex-shrink-0 rounded-xl" />
            ))}
          </div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout
      title={t('pipeline.title')}
      subtitle={t('pipeline.subtitle')}
      data-testid="pipeline-root"
      helpKey="page.journey"
    >
      <div className="space-y-6">
        {/* Header Actions */}
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder={t('pipeline.searchPlaceholder')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Kanban Board */}
        <div className="overflow-x-auto pb-4">
          <div className="flex gap-4 min-w-max" data-tour="pipeline-stages">
            {journeyByChapter.map((column, colIndex) => (
              <div 
                key={column.chapter}
                className={cn(
                  'w-80 flex-shrink-0 animate-fade-in',
                  `stagger-${colIndex + 1}`
                )}
              >
                {/* Column Header */}
                <div 
                  className="bg-card rounded-t-xl border border-border border-b-0 p-3"
                  style={{ borderTopColor: getChapterColor(column.chapter), borderTopWidth: '3px' }}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className={cn('stage-badge', getChapterBadgeClass(column.chapter))}>
                        {column.chapter}
                      </span>
                    </div>
                    <span className="text-sm font-semibold text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                      {column.items.length}
                    </span>
                  </div>
                </div>

                {/* Column Content */}
                <div className="bg-muted/30 rounded-b-xl border border-border border-t-0 p-2 min-h-[400px] space-y-2">
                  {column.items.map((item, itemIndex) => (
                    <div 
                      key={item.anchor_pipeline_id}
                      className={cn(
                        'bg-card rounded-lg border border-border p-4 cursor-pointer hover:shadow-card-hover transition-all duration-200 group animate-scale-in',
                        item.daysInStage > 30 && 'border-destructive/50 bg-destructive/5'
                      )}
                      style={{ animationDelay: `${itemIndex * 50}ms` }}
                      onClick={() => {
                        if ('_source' in item && item._source === 'opportunity' && item.opportunity_id) {
                          navigate(`/opportunities/${item.opportunity_id}`);
                        }
                      }}
                    >
                      {/* Card Header */}
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <h4 className="font-semibold text-foreground group-hover:text-primary transition-colors line-clamp-1">
                            {item.organization || t('pipeline.unknownOrganization')}
                          </h4>
                          <p className="text-sm text-muted-foreground">{item.metro || t('pipeline.noMetro')}</p>
                        </div>
                        <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors flex-shrink-0" />
                      </div>

                      {/* Probability */}
                      <div className="mb-3">
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="text-muted-foreground">{t('pipeline.probability')}</span>
                          <span className="font-semibold">{item.probability || 0}%</span>
                        </div>
                        <Progress value={item.probability || 0} className="h-1.5" />
                      </div>

                      {/* Stats */}
                      <div className="flex items-center gap-3 text-xs text-muted-foreground mb-3">
                        <div className="flex items-center gap-1">
                          <Target className="w-3.5 h-3.5" />
                          <span>{t('pipeline.perMonth', { value: item.estimated_monthly_volume || 0 })}</span>
                        </div>
                        {item.target_first_volume_date && (
                          <div className="flex items-center gap-1">
                            <Calendar className="w-3.5 h-3.5" />
                            <span>{parseISO(item.target_first_volume_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                          </div>
                        )}
                      </div>

                      {/* Days in Stage */}
                      <div className={cn(
                        'flex items-center gap-1 text-xs',
                        item.daysInStage > 30 ? 'text-destructive' : 'text-muted-foreground'
                      )}>
                        {item.daysInStage > 30 ? (
                          <AlertTriangle className="w-3.5 h-3.5" />
                        ) : (
                          <Clock className="w-3.5 h-3.5" />
                        )}
                        <span className="font-medium">{t('pipeline.daysCount', { count: item.daysInStage })}</span>
                        <span>{t('pipeline.daysInChapter')}</span>
                      </div>

                      {/* Owner + Actions */}
                      <div className="pt-3 mt-3 border-t border-border flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center">
                            <User className="w-3.5 h-3.5 text-primary" />
                          </div>
                          <span className="text-xs text-muted-foreground">{item.owner || t('pipeline.unassigned')}</span>
                        </div>

                        <div className="flex items-center gap-1">
                          {/* Move to chapter dropdown */}
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 text-xs gap-1 px-2"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <ArrowRightLeft className="w-3 h-3" />
                                Move
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                              {JOURNEY_KANBAN_CHAPTERS.filter(ch => ch !== column.chapter).map(ch => (
                                <DropdownMenuItem
                                  key={ch}
                                  onClick={() => handleMoveToChapter(item, ch)}
                                >
                                  <span className="w-2 h-2 rounded-full mr-2 flex-shrink-0" style={{ backgroundColor: getChapterColor(ch) }} />
                                  {ch}
                                </DropdownMenuItem>
                              ))}
                            </DropdownMenuContent>
                          </DropdownMenu>

                          {/* Convert to Anchor Button */}
                          {(item.stage === 'Agreement Signed' || (item.stage as string) === 'Account Setup') && (
                            <Button
                              data-tour="pipeline-convert"
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs gap-1 border-success text-success hover:bg-success/10"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleConvertClick(item.id, item.organization || 'this organization');
                              }}
                            >
                              <Anchor className="w-3 h-3" />
                              {t('pipeline.convert')}
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}

                  {column.items.length === 0 && (
                    <div className="flex items-center justify-center h-32 text-sm text-muted-foreground">
                      {t('pipeline.noOpportunities')}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Convert to Anchor Confirmation Dialog */}
      <AlertDialog open={convertDialogOpen} onOpenChange={setConvertDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('pipeline.convertDialog.title')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('pipeline.convertDialog.description', { org: selectedOrg })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={convertMutation.isPending}>{t('pipeline.convertDialog.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmConvert}
              disabled={convertMutation.isPending}
              className="bg-success hover:bg-success/90"
            >
              {convertMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  {t('pipeline.convertDialog.converting')}
                </>
              ) : (
                <>
                  <Anchor className="w-4 h-4 mr-2" />
                  {t('pipeline.convertDialog.convertToAnchor')}
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </MainLayout>
  );
}
