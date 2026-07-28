import { useState, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { MainLayout } from '@/components/layout/MainLayout';
import { useGrants, Grant, GrantStage, FunderType, GrantStatus } from '@/hooks/useGrants';
import { useMetros } from '@/hooks/useMetros';
import { useBulkSelection } from '@/hooks/useBulkSelection';
import { useBulkUpdateGrants } from '@/hooks/useBulkUpdate';
import { useDeleteWithUndo } from '@/hooks/useDeleteWithUndo';
import { cn } from '@/lib/utils';
import { 
  Search, 
  Plus, 
  FileText,
  Calendar,
  Filter,
  LayoutGrid,
  List,
  Loader2,
  X,
  DollarSign,
  Building2,
  MapPin,
  Upload,
  Download,
  Pencil,
  Trash2,
  TrendingUp,
  ExternalLink
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
import { GrantModal } from '@/components/modals/GrantModal';
import { BulkEditModal } from '@/components/modals/BulkEditModal';
import { GrantStageBadge } from '@/components/grants/GrantStageBadge';
import { StarRatingControl } from '@/components/grants/StarRatingControl';
import { CSVImportModal } from '@/components/import/CSVImportModal';
import { useImportGrants, GRANT_IMPORT_FIELDS } from '@/hooks/useImportGrants';
import { format } from 'date-fns';
import { generateCSV, downloadCSV } from '@/lib/csv';
import { GrantYearComparison } from '@/components/grants/GrantYearComparison';

const GRANT_STAGES: GrantStage[] = [
  'Researching',
  'Eligible',
  'Cultivating',
  'LOI Submitted',
  'Full Proposal Submitted',
  'Awarded',
  'Declined',
  'Closed'
];

const FUNDER_TYPES: FunderType[] = [
  'Foundation',
  'Government - Federal',
  'Government - State',
  'Government - Local',
  'Corporate',
  'Other'
];

export default function Grants() {
  const { t } = useTranslation('grants');
  const [searchQuery, setSearchQuery] = useState('');
  const [stageFilter, setStageFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [funderTypeFilter, setFunderTypeFilter] = useState<string>('all');
  const [metroFilter, setMetroFilter] = useState<string>('all');
  const [fiscalYearFilter, setFiscalYearFilter] = useState<string>('all');
  const [minStarRating, setMinStarRating] = useState<number>(0);
  const [viewMode, setViewMode] = useState<'grid' | 'list' | 'compare'>('grid');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const navigate = useNavigate();
  const [isImportModalOpen, _setIsImportModalOpen] = useState(() => sessionStorage.getItem('grants-import-open') === 'true');
  const setIsImportModalOpen = useCallback((open: boolean) => {
    if (open) {
      sessionStorage.setItem('grants-import-open', 'true');
    } else {
      sessionStorage.removeItem('grants-import-open');
    }
    _setIsImportModalOpen(open);
  }, []);
  const [isBulkEditModalOpen, setIsBulkEditModalOpen] = useState(false);
  const [isBulkDeleteDialogOpen, setIsBulkDeleteDialogOpen] = useState(false);
  
  const { data: grants, isLoading } = useGrants();
  const { data: metros } = useMetros();
  const importGrants = useImportGrants();
  const bulkUpdateGrants = useBulkUpdateGrants();
  const bulkSelection = useBulkSelection<Grant>();
  const { deleteRecords, isDeleting } = useDeleteWithUndo();
  
  // Extract unique fiscal years from grants
  const fiscalYears = useMemo(() => {
    if (!grants) return [];
    const years = new Set<number>();
    grants.forEach(g => {
      if (g.fiscal_year) years.add(g.fiscal_year);
    });
    return Array.from(years).sort((a, b) => b - a);
  }, [grants]);
  
  const hasActiveFilters = stageFilter !== 'all' || statusFilter !== 'all' || funderTypeFilter !== 'all' || metroFilter !== 'all' || fiscalYearFilter !== 'all' || minStarRating > 0 || searchQuery !== '';
  
  const clearFilters = () => {
    setStageFilter('all');
    setStatusFilter('all');
    setFunderTypeFilter('all');
    setMetroFilter('all');
    setFiscalYearFilter('all');
    setMinStarRating(0);
    setSearchQuery('');
  };
  
  const filteredGrants = (grants || []).filter(grant => {
    const matchesSearch = 
      grant.grant_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      grant.funder_name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStage = stageFilter === 'all' || grant.stage === stageFilter;
    const matchesStatus = statusFilter === 'all' || grant.status === statusFilter;
    const matchesFunderType = funderTypeFilter === 'all' || grant.funder_type === funderTypeFilter;
    const matchesMetro = metroFilter === 'all' || grant.metro_id === metroFilter;
    const matchesFiscalYear = fiscalYearFilter === 'all' || String(grant.fiscal_year) === fiscalYearFilter;
    const matchesRating = grant.star_rating >= minStarRating;
    
    return matchesSearch && matchesStage && matchesStatus && matchesFunderType && matchesMetro && matchesFiscalYear && matchesRating;
  });
  
  const handleCardClick = (grant: Grant) => {
    navigate(`/grants/${grant.id}`);
  };
  
  const formatCurrency = (amount: number | null) => {
    if (!amount) return '—';
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(amount);
  };
  
  const handleExportCSV = () => {
    const exportData = filteredGrants.map(grant => ({
      grant_name: grant.grant_name,
      funder_name: grant.funder_name,
      funder_type: grant.funder_type,
      stage: grant.stage,
      status: grant.status,
      star_rating: grant.star_rating,
      metro: grant.metros?.metro || '',
      organization: grant.opportunities?.organization || '',
      amount_requested: grant.amount_requested || '',
      amount_awarded: grant.amount_awarded || '',
      fiscal_year: grant.fiscal_year || '',
      grant_term_start: grant.grant_term_start || '',
      grant_term_end: grant.grant_term_end || '',
      is_multiyear: grant.is_multiyear ? 'Yes' : 'No',
      match_required: grant.match_required ? 'Yes' : 'No',
      reporting_required: grant.reporting_required ? 'Yes' : 'No',
      reporting_frequency: grant.reporting_frequency || '',
      notes: grant.notes || '',
    }));
    
    const csv = generateCSV(exportData, [
      { key: 'grant_name', label: 'Grant Name' },
      { key: 'funder_name', label: 'Funder Name' },
      { key: 'funder_type', label: 'Funder Type' },
      { key: 'stage', label: 'Stage' },
      { key: 'status', label: 'Status' },
      { key: 'star_rating', label: 'Star Rating' },
      { key: 'metro', label: 'Metro' },
      { key: 'organization', label: 'Linked Organization' },
      { key: 'amount_requested', label: 'Amount Requested' },
      { key: 'amount_awarded', label: 'Amount Awarded' },
      { key: 'fiscal_year', label: 'Fiscal Year' },
      { key: 'grant_term_start', label: 'Term Start' },
      { key: 'grant_term_end', label: 'Term End' },
      { key: 'is_multiyear', label: 'Multi-Year' },
      { key: 'match_required', label: 'Match Required' },
      { key: 'reporting_required', label: 'Reporting Required' },
      { key: 'reporting_frequency', label: 'Reporting Frequency' },
      { key: 'notes', label: 'Notes' },
    ]);
    
    downloadCSV(csv, `grants-export-${format(new Date(), 'yyyy-MM-dd')}.csv`);
  };
  
  const getFunderTypeBadge = (funderType: FunderType) => {
    const styles: Record<FunderType, string> = {
      'Foundation': 'bg-primary/15 text-primary',
      'Government - Federal': 'bg-info/15 text-info',
      'Government - State': 'bg-accent/15 text-accent',
      'Government - Local': 'bg-warning/15 text-warning',
      'Corporate': 'bg-success/15 text-success',
      'Other': 'bg-muted text-muted-foreground'
    };
    return styles[funderType];
  };

  return (
    <MainLayout
      title={t('page.title')}
      subtitle={t('page.subtitle')}
      helpKey="page.grants"
    >
      <div className="space-y-6">
        {/* Active Filters Banner */}
        {hasActiveFilters && (
          <div className="flex items-center gap-2 p-3 bg-primary/5 border border-primary/20 rounded-lg">
            <span className="text-sm text-muted-foreground">{t('filters.activeFilters')}</span>
            <div className="flex flex-wrap gap-2">
              {stageFilter !== 'all' && (
                <Badge variant="secondary" className="gap-1">
                  {t('filters.stageFilter', { value: stageFilter })}
                  <button onClick={() => setStageFilter('all')} className="ml-1 hover:text-destructive">
                    <X className="w-3 h-3" />
                  </button>
                </Badge>
              )}
              {statusFilter !== 'all' && (
                <Badge variant="secondary" className="gap-1">
                  {t('filters.statusFilter', { value: statusFilter })}
                  <button onClick={() => setStatusFilter('all')} className="ml-1 hover:text-destructive">
                    <X className="w-3 h-3" />
                  </button>
                </Badge>
              )}
              {funderTypeFilter !== 'all' && (
                <Badge variant="secondary" className="gap-1">
                  {t('filters.funderFilter', { value: funderTypeFilter })}
                  <button onClick={() => setFunderTypeFilter('all')} className="ml-1 hover:text-destructive">
                    <X className="w-3 h-3" />
                  </button>
                </Badge>
              )}
              {metroFilter !== 'all' && (
                <Badge variant="secondary" className="gap-1">
                  {t('filters.metroFilter', { value: metros?.find(m => m.id === metroFilter)?.metro })}
                  <button onClick={() => setMetroFilter('all')} className="ml-1 hover:text-destructive">
                    <X className="w-3 h-3" />
                  </button>
                </Badge>
              )}
              {fiscalYearFilter !== 'all' && (
                <Badge variant="secondary" className="gap-1">
                  {t('filters.fiscalYearFilter', { value: fiscalYearFilter })}
                  <button onClick={() => setFiscalYearFilter('all')} className="ml-1 hover:text-destructive">
                    <X className="w-3 h-3" />
                  </button>
                </Badge>
              )}
              {minStarRating > 0 && (
                <Badge variant="secondary" className="gap-1">
                  {t('filters.ratingFilter', { value: minStarRating })}
                  <button onClick={() => setMinStarRating(0)} className="ml-1 hover:text-destructive">
                    <X className="w-3 h-3" />
                  </button>
                </Badge>
              )}
              {searchQuery && (
                <Badge variant="secondary" className="gap-1">
                  Search: "{searchQuery}"
                  <button onClick={() => setSearchQuery('')} className="ml-1 hover:text-destructive">
                    <X className="w-3 h-3" />
                  </button>
                </Badge>
              )}
            </div>
            <Button variant="ghost" size="sm" onClick={clearFilters} className="ml-auto">
              {t('filters.clearAll')}
            </Button>
          </div>
        )}

        {/* Header Actions */}
        <div className="flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row gap-4 justify-between">
            <div className="flex gap-3 flex-1 flex-wrap">
              <div className="relative flex-1 min-w-[200px] max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder={t('filters.searchPlaceholder')}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
              <div data-tour="grants-stage-filter">
                <Select value={stageFilter} onValueChange={setStageFilter}>
                  <SelectTrigger className="w-44">
                    <Filter className="w-4 h-4 mr-2" />
                    <SelectValue placeholder={t('filters.stagePlaceholder')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t('filters.allStages')}</SelectItem>
                    {GRANT_STAGES.map(stage => (
                      <SelectItem key={stage} value={stage}>{stage}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div data-tour="grants-funder-filter">
                <Select value={funderTypeFilter} onValueChange={setFunderTypeFilter}>
                  <SelectTrigger className="w-44">
                    <SelectValue placeholder={t('filters.funderTypePlaceholder')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t('filters.allFunders')}</SelectItem>
                    {FUNDER_TYPES.map(type => (
                      <SelectItem key={type} value={type}>{type}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Select value={metroFilter} onValueChange={setMetroFilter}>
                <SelectTrigger className="w-36">
                  <SelectValue placeholder={t('filters.metroPlaceholder')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('filters.allMetros')}</SelectItem>
                  {metros?.map(metro => (
                    <SelectItem key={metro.id} value={metro.id}>{metro.metro}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={fiscalYearFilter} onValueChange={setFiscalYearFilter}>
                <SelectTrigger className="w-32">
                  <Calendar className="w-4 h-4 mr-2" />
                  <SelectValue placeholder={t('filters.fyPlaceholder')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('filters.allYears')}</SelectItem>
                  {fiscalYears.map(year => (
                    <SelectItem key={year} value={String(year)}>FY{year}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-wrap gap-2">
              {/* Select All Checkbox */}
              <div className="flex items-center gap-2 px-3 py-1 border border-border rounded-lg">
                <Checkbox
                  checked={bulkSelection.isAllSelected(filteredGrants)}
                  onCheckedChange={(checked) => {
                    if (checked) {
                      bulkSelection.selectAll(filteredGrants);
                    } else {
                      bulkSelection.clearSelection();
                    }
                  }}
                />
                <span className="text-sm">{t('buttons.selectAll')}</span>
              </div>

              {bulkSelection.selectedCount > 0 && (
                <>
                  <Button
                    variant="outline"
                    className="gap-2"
                    onClick={() => setIsBulkEditModalOpen(true)}
                  >
                    <Pencil className="w-4 h-4" />
                    <span className="hidden sm:inline">{t('buttons.edit', { count: bulkSelection.selectedCount })}</span>
                  </Button>
                  <Button
                    variant="outline"
                    className="gap-2 text-destructive hover:text-destructive hover:bg-destructive/10"
                    onClick={() => setIsBulkDeleteDialogOpen(true)}
                  >
                    <Trash2 className="w-4 h-4" />
                    <span className="hidden sm:inline">{t('buttons.delete', { count: bulkSelection.selectedCount })}</span>
                  </Button>
                </>
              )}

              <div className="flex border border-border rounded-lg p-1">
                <Button
                  variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('grid')}
                  title={t('views.grid')}
                >
                  <LayoutGrid className="w-4 h-4" />
                </Button>
                <Button
                  variant={viewMode === 'list' ? 'secondary' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('list')}
                  title={t('views.list')}
                >
                  <List className="w-4 h-4" />
                </Button>
                <Button
                  variant={viewMode === 'compare' ? 'secondary' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('compare')}
                  title={t('views.compare')}
                >
                  <TrendingUp className="w-4 h-4" />
                </Button>
              </div>
              <Button variant="outline" className="gap-1.5" onClick={handleExportCSV} disabled={filteredGrants.length === 0}>
                <Download className="w-4 h-4" />
                <span className="hidden sm:inline">{t('buttons.export')}</span>
              </Button>
              <Button variant="outline" className="gap-1.5" onClick={() => setIsImportModalOpen(true)}>
                <Upload className="w-4 h-4" />
                <span className="hidden sm:inline">{t('buttons.import')}</span>
              </Button>
              <Button className="gap-1.5" onClick={() => setIsCreateModalOpen(true)}>
                <Plus className="w-4 h-4" />
                <span className="hidden sm:inline">{t('buttons.addGrant')}</span>
              </Button>
            </div>
          </div>
        </div>

        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        )}

        {/* Results Count */}
        {!isLoading && (
          <p className="text-sm text-muted-foreground">
            {t('counts.showing', { filtered: filteredGrants.length, total: grants?.length || 0 })}
          </p>
        )}

        {/* Grants Grid */}
        {viewMode === 'compare' ? (
          <GrantYearComparison 
            onGrantClick={(grantId) => {
              navigate(`/grants/${grantId}`);
            }}
          />
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4" data-tour="grants-list">
            {filteredGrants.map((grant, index) => (
              <div 
                key={grant.id}
                onClick={() => handleCardClick(grant)}
                className={cn(
                  'bg-card rounded-xl border border-border p-5 hover:shadow-card-hover transition-all duration-200 animate-fade-in group cursor-pointer relative',
                  bulkSelection.isSelected(grant.id) && 'ring-2 ring-primary',
                  `stagger-${(index % 6) + 1}`
                )}
              >
                {/* Selection Checkbox */}
                <div 
                  className="absolute top-3 right-3 z-10"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Checkbox
                    checked={bulkSelection.isSelected(grant.id)}
                    onCheckedChange={() => bulkSelection.toggle(grant.id)}
                  />
                </div>
                {/* Header */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary/10 rounded-lg">
                      <FileText className="w-5 h-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors line-clamp-1">
                        {grant.grant_name}
                      </h3>
                      <p className="text-sm text-muted-foreground line-clamp-1">{grant.funder_name}</p>
                    </div>
                  </div>
                  <StarRatingControl value={grant.star_rating} readonly size="sm" />
                </div>

                {/* Badges */}
                <div className="flex flex-wrap gap-2 mb-4">
                  <GrantStageBadge stage={grant.stage} />
                  <span className={cn('status-badge', getFunderTypeBadge(grant.funder_type))}>
                    {grant.funder_type}
                  </span>
                  {grant.fiscal_year && (
                    <Badge variant="outline" className="text-xs">FY{grant.fiscal_year}</Badge>
                  )}
                </div>

                {/* Amount Info */}
                <div className="flex items-center gap-4 mb-4">
                  <div className="flex items-center gap-1.5">
                    <DollarSign className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm">
                      <span className="text-muted-foreground">{t('card.requested')}</span>{' '}
                      <span className="font-medium">{formatCurrency(grant.amount_requested)}</span>
                    </span>
                  </div>
                </div>

                {/* Metro, Dates & Source URL */}
                <div className="pt-3 border-t border-border space-y-2">
                  {grant.source_url && (
                    <div className="flex items-center gap-2 text-sm" onClick={(e) => e.stopPropagation()}>
                      <ExternalLink className="w-4 h-4 text-muted-foreground shrink-0" />
                      <a 
                        href={grant.source_url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-primary hover:underline truncate"
                      >
                        {t('card.viewSource')}
                      </a>
                    </div>
                  )}
                  {grant.metros?.metro && (
                    <div className="flex items-center gap-2 text-sm">
                      <MapPin className="w-4 h-4 text-muted-foreground" />
                      <span>{grant.metros.metro}</span>
                    </div>
                  )}
                  {grant.grant_term_end && (
                    <div className="flex items-center gap-2 text-sm">
                      <Calendar className="w-4 h-4 text-muted-foreground" />
                      <span className="text-muted-foreground">{t('card.ends')}</span>
                      <span className="font-medium">{format(new Date(grant.grant_term_end), 'MMM d, yyyy')}</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-card rounded-xl border border-border overflow-hidden">
            <table className="data-table">
              <thead>
                <tr>
                  <th>{t('table.grant')}</th>
                  <th>{t('table.funder')}</th>
                  <th>{t('table.stage')}</th>
                  <th>{t('table.type')}</th>
                  <th>{t('table.fy')}</th>
                  <th>{t('table.amountRequested')}</th>
                  <th>{t('table.metro')}</th>
                  <th>{t('table.rating')}</th>
                </tr>
              </thead>
              <tbody>
                {filteredGrants.map(grant => (
                  <tr key={grant.id} onClick={() => handleCardClick(grant)} className="cursor-pointer">
                    <td className="font-medium">{grant.grant_name}</td>
                    <td className="text-muted-foreground">{grant.funder_name}</td>
                    <td><GrantStageBadge stage={grant.stage} /></td>
                    <td>
                      <span className={cn('status-badge text-xs', getFunderTypeBadge(grant.funder_type))}>
                        {grant.funder_type}
                      </span>
                    </td>
                    <td>{grant.fiscal_year ? `FY${grant.fiscal_year}` : '—'}</td>
                    <td>{formatCurrency(grant.amount_requested)}</td>
                    <td>{grant.metros?.metro || '—'}</td>
                    <td><StarRatingControl value={grant.star_rating} readonly size="sm" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Empty State */}
        {!isLoading && filteredGrants.length === 0 && (
          <div className="text-center py-12">
            <FileText className="w-12 h-12 text-muted-foreground/50 mx-auto mb-4" />
            <h3 className="font-semibold mb-2">{t('empty.noGrantsFound')}</h3>
            <p className="text-muted-foreground mb-4">
              {hasActiveFilters ? t('empty.adjustFilters') : t('empty.getStarted')}
            </p>
            {!hasActiveFilters && (
              <Button onClick={() => setIsCreateModalOpen(true)}>
                <Plus className="w-4 h-4 mr-2" />
                {t('buttons.addGrant')}
              </Button>
            )}
          </div>
        )}
      </div>

      <GrantModal 
        open={isCreateModalOpen} 
        onOpenChange={setIsCreateModalOpen}
      />
      
      
      <CSVImportModal
        open={isImportModalOpen}
        onOpenChange={setIsImportModalOpen}
        title={t('import.title')}
        fields={GRANT_IMPORT_FIELDS}
        onImport={async (data) => {
          await importGrants.mutateAsync(data);
        }}
        historyType="grants"
      />

      <BulkEditModal
        open={isBulkEditModalOpen}
        onOpenChange={(open) => {
          setIsBulkEditModalOpen(open);
          if (!open) bulkSelection.clearSelection();
        }}
        selectedItems={bulkSelection.getSelectedItems(filteredGrants)}
        entityType="grant"
        onBulkUpdate={async (ids, updates) => {
          await bulkUpdateGrants.mutateAsync({ ids, updates });
        }}
      />

      <AlertDialog open={isBulkDeleteDialogOpen} onOpenChange={setIsBulkDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('bulkDelete.title', { count: bulkSelection.selectedCount })}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('bulkDelete.description')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('deleteDialog.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                const ids = Array.from(bulkSelection.selectedIds);
                await deleteRecords(ids, 'grant');
                bulkSelection.clearSelection();
                setIsBulkDeleteDialogOpen(false);
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={isDeleting}
            >
              {isDeleting ? t('bulkDelete.deleting') : t('bulkDelete.confirmDelete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </MainLayout>
  );
}
