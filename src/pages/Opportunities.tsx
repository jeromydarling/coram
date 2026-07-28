import { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTenantNavigate } from '@/hooks/useTenantPath';
import { MainLayout } from '@/components/layout/MainLayout';
import { useOpportunities } from '@/hooks/useOpportunities';
import { useSectors } from '@/hooks/useSectors';
import { useGrantAlignments } from '@/hooks/useGrantAlignments';
import { useBulkSelection } from '@/hooks/useBulkSelection';
import { useBulkUpdateOpportunities } from '@/hooks/useBulkUpdate';
import { useDeleteWithUndo } from '@/hooks/useDeleteWithUndo';
import { useOpportunitySignalsBatch } from '@/hooks/useOpportunitySignals';
import { SignalsBadge } from '@/components/opportunity/SignalsBadge';
import { SignalsDrawer } from '@/components/opportunity/SignalsDrawer';
import { InlineStageEdit, InlineNextStepEdit } from '@/components/opportunity/InlineEdits';
import { cn } from '@/lib/utils';
import {
  Search,
  Plus,
  Building2,
  Mail,
  Calendar,
  Filter,
  LayoutGrid,
  List,
  Loader2,
  X,
  Pencil,
  Trash2,
  ArrowRight
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
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
import { VigiliaCompanionCard } from '@/components/vigilia/VigiliaCompanionCard';
import { CommunioAwarenessCard } from '@/components/communio/CommunioAwarenessCard';
import { useGlobalModal } from '@/contexts/GlobalModalContext';
import { BulkEditModal } from '@/components/modals/BulkEditModal';
import { PaginationControls, usePagination } from '@/components/ui/pagination-controls';
import { useTranslation } from 'react-i18next';

type OpportunityStage = 'Target Identified' | 'Contacted' | 'Discovery Scheduled' | 'Discovery Held' | 'Proposal Sent' | 'Agreement Pending' | 'Agreement Signed' | 'First Volume' | 'Stable Producer' | 'Closed - Not a Fit';

const STAGE_ORDER: OpportunityStage[] = [
  'Target Identified', 'Contacted', 'Discovery Scheduled', 'Discovery Held',
  'Proposal Sent', 'Agreement Pending', 'Agreement Signed', 'First Volume',
  'Stable Producer', 'Closed - Not a Fit'
];
type OpportunityStatus = 'Active' | 'On Hold' | 'Closed - Won' | 'Closed - Lost';
type PartnerTier = 'Anchor' | 'Distribution' | 'Referral' | 'Workforce' | 'Housing' | 'Education' | 'Other';

interface Opportunity {
  id: string;
  opportunity_id: string;
  organization: string;
  slug?: string | null;
  metro_id?: string | null;
  stage?: string | null;
  status?: string | null;
  partner_tier?: string | null;
  partner_tiers?: string[] | null;
  mission_snapshot?: string[] | null;
  best_partnership_angle?: string[] | null;
  grant_alignment?: string[] | null;
  primary_contact?: {
    id: string;
    name: string;
    title?: string | null;
    email?: string | null;
    phone?: string | null;
  } | null;
  next_action_due?: string | null;
  next_step?: string | null;
  notes?: string | null;
  metros?: { metro: string } | null;
}

export default function Opportunities() {
  const { t } = useTranslation('relationships');
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useTenantNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [stageFilter, setStageFilter] = useState<string>('all');
  const [tierFilter, setTierFilter] = useState<string>('all');
  const [grantFilter, setGrantFilter] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const { openOpportunityModal } = useGlobalModal();
  const [isBulkEditModalOpen, setIsBulkEditModalOpen] = useState(false);
  const [isBulkDeleteDialogOpen, setIsBulkDeleteDialogOpen] = useState(false);
  const [signalsDrawerOppId, setSignalsDrawerOppId] = useState<string | null>(null);
  const [signalsDrawerOrgName, setSignalsDrawerOrgName] = useState('');

  const { data: opportunities, isLoading } = useOpportunities();
  const { data: sectors } = useSectors(true);
  const { data: grantAlignments } = useGrantAlignments(true);
  const bulkUpdateOpportunities = useBulkUpdateOpportunities();
  const bulkSelection = useBulkSelection<Opportunity>();
  const { deleteRecords, isDeleting } = useDeleteWithUndo();



  // Read URL params on mount and when they change
  useEffect(() => {
    const tierParam = searchParams.get('tier');
    const grantParam = searchParams.get('grant');

    if (tierParam) {
      setTierFilter(tierParam);
    }
    if (grantParam) {
      setGrantFilter(grantParam);
    }
  }, [searchParams]);

  // Clear URL params when filters change manually
  const handleTierChange = (value: string) => {
    setTierFilter(value);
    const newParams = new URLSearchParams(searchParams);
    if (value === 'all') {
      newParams.delete('tier');
    } else {
      newParams.set('tier', value);
    }
    setSearchParams(newParams);
  };

  const handleGrantChange = (value: string) => {
    setGrantFilter(value);
    const newParams = new URLSearchParams(searchParams);
    if (value === 'all') {
      newParams.delete('grant');
    } else {
      newParams.set('grant', value);
    }
    setSearchParams(newParams);
  };

  const clearFilters = () => {
    setTierFilter('all');
    setGrantFilter('all');
    setStageFilter('all');
    setSearchQuery('');
    setSearchParams(new URLSearchParams());
  };

  const hasActiveFilters = tierFilter !== 'all' || grantFilter !== 'all' || stageFilter !== 'all' || searchQuery !== '';

  // Build partner tiers list from dynamic sectors or fallback
  const partnerTiers = sectors?.map(s => s.name) || ['Anchor', 'Distribution', 'Referral', 'Workforce', 'Housing', 'Education', 'Other'];

  // Build grant alignments list from dynamic data or fallback
  const grantAlignmentsList = grantAlignments?.map(g => g.name) || ['Digital Equity', 'Workforce Development', 'Housing Stability', 'Education', 'Refugee Services'];

  const filteredOpportunities = useMemo(() => {
    return (opportunities || []).filter(opp => {
      const matchesSearch = opp.organization.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStage = stageFilter === 'all' || opp.stage === stageFilter;
      const tiers = opp.partner_tiers?.length ? opp.partner_tiers : [opp.partner_tier || 'Other'];
      const matchesTier = tierFilter === 'all' || tiers.includes(tierFilter);
      const matchesGrant = grantFilter === 'all' || (opp.grant_alignment || []).includes(grantFilter);
      return matchesSearch && matchesStage && matchesTier && matchesGrant;
    });
  }, [opportunities, searchQuery, stageFilter, tierFilter, grantFilter]);

  // Pagination
  const pagination = usePagination(filteredOpportunities.length, 24);
  const paginatedOpportunities = useMemo(() => {
    return filteredOpportunities.slice(pagination.startIndex, pagination.endIndex);
  }, [filteredOpportunities, pagination.startIndex, pagination.endIndex]);

  // Batch-fetch signals for visible opportunities
  const opportunityIds = useMemo(() => paginatedOpportunities.map(o => o.id), [paginatedOpportunities]);
  const { data: signalsMap } = useOpportunitySignalsBatch(opportunityIds);

  // Reset pagination when filters change
  useEffect(() => {
    pagination.handlePageChange(1);
  }, [searchQuery, stageFilter, tierFilter, grantFilter]);

  const getStageBadge = (stage: OpportunityStage) => {
    const stageStyles: Record<string, string> = {
      'Target Identified': 'stage-target',
      'Contacted': 'stage-contacted',
      'Discovery Scheduled': 'stage-discovery',
      'Discovery Held': 'stage-discovery',
      'Proposal Sent': 'stage-proposal',
      'Agreement Pending': 'stage-agreement',
      'Agreement Signed': 'stage-signed',
      'First Volume': 'stage-volume',
      'Stable Producer': 'stage-volume',
      'Closed - Not a Fit': 'bg-muted text-muted-foreground'
    };
    return stageStyles[stage] || 'stage-target';
  };

  const getStatusBadge = (status: OpportunityStatus) => {
    const styles = {
      'Active': 'bg-success/15 text-success',
      'On Hold': 'bg-warning/15 text-warning',
      'Closed - Won': 'bg-primary/15 text-primary',
      'Closed - Lost': 'bg-muted text-muted-foreground'
    };
    return styles[status] || 'bg-muted text-muted-foreground';
  };

  const getTierBadge = (tier: PartnerTier) => {
    const styles: Record<string, string> = {
      'Anchor': 'bg-accent/15 text-accent border border-accent/30',
      'Distribution': 'bg-primary/15 text-primary',
      'Referral': 'bg-info/15 text-info',
      'Workforce': 'bg-warning/15 text-warning',
      'Housing': 'bg-success/15 text-success',
      'Education': 'bg-chart-5/15 text-[hsl(var(--chart-5))]',
      'Other': 'bg-muted text-muted-foreground'
    };
    return styles[tier] || 'bg-muted text-muted-foreground';
  };

  const handleCardClick = (opp: Opportunity) => {
    navigate(`/opportunities/${opp.slug || opp.id}`);
  };

  const handleAdd = () => {
    openOpportunityModal(null);
  };

  const handleBulkAdvanceStage = async () => {
    const selected = bulkSelection.getSelectedItems(filteredOpportunities);
    const updates: Promise<unknown>[] = [];
    for (const opp of selected) {
      const currentIdx = STAGE_ORDER.indexOf(opp.stage as OpportunityStage);
      if (currentIdx >= 0 && currentIdx < STAGE_ORDER.length - 1) {
        const nextStage = STAGE_ORDER[currentIdx + 1];
        updates.push(
          bulkUpdateOpportunities.mutateAsync({
            ids: [opp.id],
            updates: { stage: nextStage },
          })
        );
      }
    }
    await Promise.all(updates);
    bulkSelection.clearSelection();
  };


  return (
    <MainLayout
      title={t('opportunities.title')}
      subtitle={t('opportunities.subtitle')}
      data-testid="opportunities-page"
    >
      <div className="space-y-6">
        {/* Vigilia Companion */}
        <VigiliaCompanionCard compact />
        {/* Communio Awareness */}
        <CommunioAwarenessCard compact />

        {/* Active Filters Banner */}
        {hasActiveFilters && (
          <div className="flex items-center gap-2 p-3 bg-primary/5 border border-primary/20 rounded-lg">
            <span className="text-sm text-muted-foreground">{t('opportunities.activeFilters')}</span>
            <div className="flex flex-wrap gap-2">
              {tierFilter !== 'all' && (
                <Badge variant="secondary" className="gap-1">
                  {t('opportunities.filterTier', { value: tierFilter })}
                  <button onClick={() => handleTierChange('all')} className="ml-1 hover:text-destructive">
                    <X className="w-3 h-3" />
                  </button>
                </Badge>
              )}
              {grantFilter !== 'all' && (
                <Badge variant="secondary" className="gap-1">
                  {t('opportunities.filterGrant', { value: grantFilter })}
                  <button onClick={() => handleGrantChange('all')} className="ml-1 hover:text-destructive">
                    <X className="w-3 h-3" />
                  </button>
                </Badge>
              )}
              {stageFilter !== 'all' && (
                <Badge variant="secondary" className="gap-1">
                  {t('opportunities.filterStage', { value: stageFilter })}
                  <button onClick={() => setStageFilter('all')} className="ml-1 hover:text-destructive">
                    <X className="w-3 h-3" />
                  </button>
                </Badge>
              )}
              {searchQuery && (
                <Badge variant="secondary" className="gap-1">
                  {t('opportunities.filterSearch', { value: searchQuery })}
                  <button onClick={() => setSearchQuery('')} className="ml-1 hover:text-destructive">
                    <X className="w-3 h-3" />
                  </button>
                </Badge>
              )}
            </div>
            <Button variant="ghost" size="sm" onClick={clearFilters} className="ml-auto">
              {t('opportunities.clearAll')}
            </Button>
          </div>
        )}

        {/* Header Actions */}
        <div className="flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row gap-4 justify-between">
            <div className="flex gap-3 flex-1 flex-wrap">
              <div className="relative flex-1 min-w-[200px] max-w-md" data-tour="opps-search">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder={t('opportunities.searchPlaceholder')}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
              <div data-tour="opps-stage-filter">
                <Select value={stageFilter} onValueChange={setStageFilter}>
                  <SelectTrigger className="w-44">
                    <Filter className="w-4 h-4 mr-2" />
                    <SelectValue placeholder={t('opportunities.fields.stage')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t('opportunities.allStages')}</SelectItem>
                    <SelectItem value="Target Identified">Target Identified</SelectItem>
                    <SelectItem value="Contacted">Contacted</SelectItem>
                    <SelectItem value="Discovery Held">Discovery Held</SelectItem>
                    <SelectItem value="Proposal Sent">Proposal Sent</SelectItem>
                    <SelectItem value="Agreement Signed">Agreement Signed</SelectItem>
                    <SelectItem value="First Volume">First Volume</SelectItem>
                    <SelectItem value="Stable Producer">Stable Producer</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Select value={tierFilter} onValueChange={handleTierChange}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder={t('opportunities.allTiers')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('opportunities.allTiers')}</SelectItem>
                  {partnerTiers.map(tier => (
                    <SelectItem key={tier} value={tier}>{tier}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={grantFilter} onValueChange={handleGrantChange}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder={t('opportunities.allGrants')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('opportunities.allGrants')}</SelectItem>
                  {grantAlignmentsList.map(grant => (
                    <SelectItem key={grant} value={grant}>{grant}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2">
              {/* Select All Checkbox */}
              <div className="flex items-center gap-2 px-3 py-1 border border-border rounded-lg">
                <Checkbox
                  checked={bulkSelection.isAllSelected(filteredOpportunities)}
                  onCheckedChange={(checked) => {
                    if (checked) {
                      bulkSelection.selectAll(filteredOpportunities);
                    } else {
                      bulkSelection.clearSelection();
                    }
                  }}
                />
                <span className="text-sm">{t('opportunities.selectAll')}</span>
              </div>

              {bulkSelection.selectedCount > 0 && (
                <>
                  <Button
                    variant="outline"
                    className="gap-2"
                    onClick={() => setIsBulkEditModalOpen(true)}
                  >
                    <Pencil className="w-4 h-4" />
                    {t('opportunities.edit', { count: bulkSelection.selectedCount })}
                  </Button>
                  <Button
                    variant="outline"
                    className="gap-2 text-primary"
                    onClick={handleBulkAdvanceStage}
                  >
                    <ArrowRight className="w-4 h-4" />
                    {t('opportunities.advanceStage')}
                  </Button>
                  <Button
                    variant="outline"
                    className="gap-2 text-destructive hover:text-destructive hover:bg-destructive/10"
                    onClick={() => setIsBulkDeleteDialogOpen(true)}
                  >
                    <Trash2 className="w-4 h-4" />
                    {t('opportunities.delete', { count: bulkSelection.selectedCount })}
                  </Button>
                </>
              )}

              <div className="flex border border-border rounded-lg p-1" data-tour="opps-view-toggle">
                <Button
                  variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('grid')}
                >
                  <LayoutGrid className="w-4 h-4" />
                </Button>
                <Button
                  variant={viewMode === 'list' ? 'secondary' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('list')}
                >
                  <List className="w-4 h-4" />
                </Button>
              </div>
              <Button className="gap-2" onClick={handleAdd}>
                <Plus className="w-4 h-4" />
                {t('opportunities.addOpp')}
              </Button>
            </div>
          </div>
        </div>

        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        )}

        {/* Results Count - now handled by pagination */}

        {/* Opportunities Grid */}
        {viewMode === 'grid' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4" data-tour="opps-card-grid">
            {paginatedOpportunities.map((opp, index) => (
            <div
              key={opp.id}
              onClick={() => handleCardClick(opp)}
              data-testid="opportunity-row"
              className={cn(
                'bg-card rounded-xl border border-border p-5 hover:shadow-card-hover transition-all duration-200 animate-fade-in group cursor-pointer relative',
                bulkSelection.isSelected(opp.id) && 'ring-2 ring-primary',
                `stagger-${(index % 6) + 1}`
              )}
            >
              {/* Selection Checkbox */}
              <div
                className="absolute top-3 right-3 z-10"
                onClick={(e) => e.stopPropagation()}
              >
                <Checkbox
                  checked={bulkSelection.isSelected(opp.id)}
                  onCheckedChange={() => bulkSelection.toggle(opp.id)}
                />
              </div>
              {/* Header */}
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <Building2 className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors line-clamp-1">
                      {opp.organization}
                    </h3>
                    <p className="text-sm text-muted-foreground">{opp.metros?.metro || t('opportunities.noMetro')}</p>
                  </div>
                </div>
              </div>

                {/* Badges */}
                <div className="flex flex-wrap gap-2 mb-4">
                  <span className={cn('stage-badge', getStageBadge(opp.stage as OpportunityStage))}>
                    <InlineStageEdit opportunityId={opp.id} currentStage={opp.stage || 'Target Identified'} />
                  </span>
                  {/* Display multiple partner tiers */}
                  {(opp.partner_tiers?.length ? opp.partner_tiers : [opp.partner_tier || 'Other']).map((tier, index) => (
                    <span key={index} className={cn('status-badge', getTierBadge(tier as PartnerTier))}>
                      {tier}
                    </span>
                  ))}
                  {signalsMap?.get(opp.id) && (
                    <SignalsBadge
                      summary={signalsMap.get(opp.id)!}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSignalsDrawerOppId(opp.id);
                        setSignalsDrawerOrgName(opp.organization);
                      }}
                    />
                  )}
                </div>

                {/* Contact Info */}
                {opp.primary_contact && (
                <div className="space-y-2 mb-4">
                  <div className="space-y-0.5 text-sm">
                    <p className="font-medium text-foreground">{opp.primary_contact.name}</p>
                    {opp.primary_contact.title && (
                      <p className="text-muted-foreground">{opp.primary_contact.title}</p>
                    )}
                  </div>
                  {opp.primary_contact.email && (
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Mail className="w-3.5 h-3.5" />
                      <span className="truncate max-w-[120px]">{opp.primary_contact.email}</span>
                    </div>
                  </div>
                  )}
                </div>
                )}

                {/* Next Action */}
                {opp.next_action_due && (
                <div className="pt-3 border-t border-border">
                  <div className="flex items-center gap-2 text-sm">
                    <Calendar className="w-4 h-4 text-muted-foreground" />
                    <span className="text-muted-foreground">{t('opportunities.due')}</span>
                    <span className="font-medium">{new Date(opp.next_action_due).toLocaleDateString()}</span>
                  </div>
                  {opp.next_step && (
                    <div className="text-sm text-muted-foreground mt-1 line-clamp-1">
                      <InlineNextStepEdit opportunityId={opp.id} currentValue={opp.next_step} />
                    </div>
                  )}
                </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-card rounded-xl border border-border overflow-hidden">
            <table className="data-table">
              <thead>
                <tr>
                  <th>{t('opportunities.tableOrganization')}</th>
                  <th>{t('opportunities.tableMetro')}</th>
                  <th>{t('opportunities.tableStage')}</th>
                  <th>{t('opportunities.tableTier')}</th>
                  <th>{t('opportunities.tablePrimaryContact')}</th>
                  <th>{t('opportunities.tableNextAction')}</th>
                  <th>{t('opportunities.tableStatus')}</th>
                  <th>{t('opportunities.tableSignals')}</th>
                </tr>
              </thead>
              <tbody>
                {paginatedOpportunities.map((opp, index) => (
                  <tr
                    key={opp.id}
                    onClick={() => handleCardClick(opp)}
                    className={cn('animate-fade-in cursor-pointer hover:bg-muted/50 transition-colors', `stagger-${(index % 6) + 1}`)}
                  >
                    <td className="font-medium text-foreground">{opp.organization}</td>
                    <td className="text-muted-foreground">{opp.metros?.metro || '-'}</td>
                    <td>
                      <span className={cn('stage-badge', getStageBadge(opp.stage as OpportunityStage))}>
                        {opp.stage}
                      </span>
                    </td>
                    <td>
                      <div className="flex flex-wrap gap-1">
                        {(opp.partner_tiers?.length ? opp.partner_tiers : [opp.partner_tier || 'Other']).map((tier, index) => (
                          <span key={index} className={cn('status-badge', getTierBadge(tier as PartnerTier))}>
                            {tier}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td>
                      <div>
                        <p className="font-medium">{opp.primary_contact?.name || '-'}</p>
                        <p className="text-xs text-muted-foreground">{opp.primary_contact?.title || ''}</p>
                      </div>
                    </td>
                    <td>
                      <div>
                        <p className="font-medium">{opp.next_action_due ? new Date(opp.next_action_due).toLocaleDateString() : '-'}</p>
                        <p className="text-xs text-muted-foreground line-clamp-1">{opp.next_step || ''}</p>
                      </div>
                    </td>
                    <td>
                      <span className={cn('status-badge', getStatusBadge(opp.status as OpportunityStatus))}>
                        {opp.status}
                      </span>
                    </td>
                    <td>
                      {signalsMap?.get(opp.id) && (
                        <SignalsBadge
                          summary={signalsMap.get(opp.id)!}
                          onClick={(e) => {
                            e.stopPropagation();
                            setSignalsDrawerOppId(opp.id);
                            setSignalsDrawerOrgName(opp.organization);
                          }}
                        />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Controls */}
        {!isLoading && filteredOpportunities.length > 0 && (
          <PaginationControls
            currentPage={pagination.currentPage}
            totalPages={pagination.totalPages}
            pageSize={pagination.pageSize}
            totalItems={filteredOpportunities.length}
            onPageChange={pagination.handlePageChange}
            onPageSizeChange={pagination.handlePageSizeChange}
          />
        )}

        {/* OpportunityModal is now rendered globally in App.tsx */}

        <BulkEditModal
          open={isBulkEditModalOpen}
          onOpenChange={(open) => {
            setIsBulkEditModalOpen(open);
            if (!open) bulkSelection.clearSelection();
          }}
          selectedItems={bulkSelection.getSelectedItems(filteredOpportunities)}
          entityType="opportunity"
          onBulkUpdate={async (ids, updates) => {
            await bulkUpdateOpportunities.mutateAsync({ ids, updates });
          }}
        />

        <AlertDialog open={isBulkDeleteDialogOpen} onOpenChange={setIsBulkDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {bulkSelection.selectedCount !== 1
                  ? t('opportunities.deleteDialogTitle_other', { count: bulkSelection.selectedCount })
                  : t('opportunities.deleteDialogTitle_one', { count: bulkSelection.selectedCount })}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {t('opportunities.deleteDialogDescription')}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t('opportunities.cancel')}</AlertDialogCancel>
              <AlertDialogAction
                onClick={async () => {
                  const ids = Array.from(bulkSelection.selectedIds);
                  await deleteRecords(ids, 'opportunity');
                  bulkSelection.clearSelection();
                  setIsBulkDeleteDialogOpen(false);
                }}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                disabled={isDeleting}
              >
                {isDeleting ? t('opportunities.deleting') : t('opportunities.deletePeople')}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <SignalsDrawer
          opportunityId={signalsDrawerOppId}
          organizationName={signalsDrawerOrgName}
          open={!!signalsDrawerOppId}
          onOpenChange={(open) => { if (!open) setSignalsDrawerOppId(null); }}
        />
      </div>
    </MainLayout>
  );
}
