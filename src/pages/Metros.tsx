import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useTenantPath } from '@/hooks/useTenantPath';
import { MainLayout } from '@/components/layout/MainLayout';
import { useMetrosWithComputed, useCreateMetro, useDeleteMetro, MetroWithComputed } from '@/hooks/useMetros';
import { useRegions } from '@/hooks/useRegions';
import { cn } from '@/lib/utils';
import { 
  Search, 
  MapPin, 
  Users, 
  TrendingUp,
  Filter,
  Loader2,
  Globe,
  Pencil,
  Trash2,
  Plus
} from 'lucide-react';
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export default function Metros() {
  const { t } = useTranslation('metros');
  const { data: metros, isLoading, error } = useMetrosWithComputed();
  const { data: regions } = useRegions();
  const deleteMetro = useDeleteMetro();
  const createMetro = useCreateMetro();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [regionFilter, setRegionFilter] = useState<string>('all');
  const [metroToDelete, setMetroToDelete] = useState<MetroWithComputed | null>(null);
  const [showAddMetro, setShowAddMetro] = useState(false);
  const [newMetroName, setNewMetroName] = useState('');
  const [newMetroRegion, setNewMetroRegion] = useState('');
  const navigate = useNavigate();
  const { tenantPath } = useTenantPath();

  const handleCreateMetro = () => {
    if (!newMetroName.trim()) return;
    const metro_id = newMetroName.trim().toLowerCase().replace(/\s+/g, '_').substring(0, 20);
    createMetro.mutate({
      metro_id,
      metro: newMetroName.trim(),
      region_id: newMetroRegion || undefined,
    } as any, {
      onSuccess: () => {
        setNewMetroName('');
        setNewMetroRegion('');
        setShowAddMetro(false);
      }
    });
  };

  const filteredMetros = (metros || []).filter(metro => {
    const matchesSearch = metro.metro.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || metro.metroStatus === statusFilter;
    const matchesRegion = regionFilter === 'all' || metro.region_id === regionFilter || (regionFilter === 'unassigned' && !metro.region_id);
    return matchesSearch && matchesStatus && matchesRegion;
  });

  // Group metros by region
  const groupedMetros = filteredMetros.reduce((acc, metro) => {
    const regionName = metro.region?.name || 'Unassigned';
    if (!acc[regionName]) {
      acc[regionName] = {
        region: metro.region,
        metros: []
      };
    }
    acc[regionName].metros.push(metro);
    return acc;
  }, {} as Record<string, { region: MetroWithComputed['region']; metros: MetroWithComputed[] }>);

  const getStatusBadge = (status: MetroWithComputed['metroStatus']) => {
    const styles = {
      'Expansion Ready': 'status-expansion-ready',
      'Anchor Build': 'status-anchor-build',
      'Ecosystem Dev': 'status-ecosystem-dev'
    };
    return styles[status] || 'status-ecosystem-dev';
  };

  const getRecommendationBadge = (rec: MetroWithComputed['recommendation']) => {
    const styles = {
      'Invest': 'recommendation-invest',
      'Build Anchors': 'recommendation-build',
      'Hold': 'recommendation-hold',
      'Triage': 'recommendation-triage'
    };
    return styles[rec || 'Hold'] || 'recommendation-hold';
  };

  const getScoreColor = (score: number) => {
    if (score >= 75) return 'hsl(var(--primary))';
    if (score >= 50) return 'hsl(var(--warning))';
    return 'hsl(var(--muted-foreground))';
  };

  if (isLoading) {
    return (
      <MainLayout title={t('metros.title')} subtitle={t('metros.subtitle')}>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </MainLayout>
    );
  }

  if (error) {
    return (
      <MainLayout title={t('metros.title')} subtitle={t('metros.subtitle')}>
        <div className="text-center py-12">
          <p className="text-destructive">Error loading metros: {error.message}</p>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout
      title={t('metros.title')}
      subtitle={t('metros.subtitle')}
      helpKey="page.metros"
      data-testid="metros-root"
    >
      <div className="space-y-6">
        {/* Header Actions */}
        <div className="flex flex-col sm:flex-row gap-4 justify-between">
          <div className="flex gap-3 flex-1 flex-wrap">
            <div className="relative flex-1 min-w-[200px] max-w-md" data-tour="metro-search">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder={t('metros.searchPlaceholder')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-40">
                <Filter className="w-4 h-4 mr-2" />
                <SelectValue placeholder={t('metros.filters.allStatuses')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('metros.filters.allStatuses')}</SelectItem>
                <SelectItem value="Expansion Ready">{t('metros.filters.expansionReady')}</SelectItem>
                <SelectItem value="Anchor Build">{t('metros.filters.anchorBuild')}</SelectItem>
                <SelectItem value="Ecosystem Dev">{t('metros.filters.ecosystemDev')}</SelectItem>
              </SelectContent>
            </Select>
            <div data-tour="metro-region-filter">
              <Select value={regionFilter} onValueChange={setRegionFilter}>
                <SelectTrigger className="w-44">
                  <Globe className="w-4 h-4 mr-2" />
                  <SelectValue placeholder={t('metros.filters.allRegions')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('metros.filters.allRegions')}</SelectItem>
                  <SelectItem value="unassigned">{t('metros.filters.unassigned')}</SelectItem>
                  {(regions || []).map(region => (
                    <SelectItem key={region.id} value={region.id}>{region.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <Button onClick={() => setShowAddMetro(true)} className="w-full sm:w-auto flex-shrink-0">
            <Plus className="w-4 h-4 mr-2" />
            {t('metros.addMetro')}
          </Button>
        </div>

        {/* Metro Cards grouped by Region */}
        {filteredMetros.length === 0 ? (
          <div className="text-center py-12">
            <MapPin className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">{t('metros.noMetrosFound')}</p>
          </div>
        ) : (
          <div className="space-y-8">
            {Object.entries(groupedMetros)
              .sort(([a], [b]) => a === 'Unassigned' ? 1 : b === 'Unassigned' ? -1 : a.localeCompare(b))
              .map(([regionName, { region, metros: regionMetros }]) => (
              <div key={regionName}>
                {/* Region Header */}
                <div className="flex items-center gap-3 mb-4">
                  <div 
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: region?.color || 'hsl(var(--muted-foreground))' }}
                  />
                  <h2 className="text-lg font-semibold">{regionName}</h2>
                  <span className="text-sm text-muted-foreground">{t('metros.regionCount', { count: regionMetros.length })}</span>
                </div>
                
                {/* Metro Cards Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4" data-tour="metro-cards">
                  {regionMetros.map((metro, index) => (
                    <div 
                      key={metro.id}
                      onClick={() => navigate(tenantPath(`/metros/${metro.id}`))}
                      className={cn(
                        'bg-card rounded-xl border border-border p-5 hover:shadow-card-hover transition-all duration-200 cursor-pointer animate-fade-in group',
                        `stagger-${(index % 6) + 1}`
                      )}
                    >
                      {/* Header */}
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-primary/10 rounded-lg">
                            <MapPin className="w-5 h-5 text-primary" />
                          </div>
                          <div>
                            <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors">
                              {metro.metro}
                            </h3>
                            <span className={cn('status-badge text-xs', getStatusBadge(metro.metroStatus))}>
                              {metro.metroStatus}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(tenantPath(`/metros/${metro.id}`));
                            }}
                            className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-primary transition-colors"
                            title="Edit metro"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setMetroToDelete(metro);
                            }}
                            className="p-1.5 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                            title="Delete metro"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      {/* Readiness Score */}
                      <div className="mb-4">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm text-muted-foreground">{t('metros.card.readinessIndex')}</span>
                          <span 
                            className="font-bold text-lg"
                            style={{ color: getScoreColor(metro.metroReadinessIndex) }}
                          >
                            {metro.metroReadinessIndex}
                          </span>
                        </div>
                        <div className="score-bar">
                          <div 
                            className="score-fill"
                            style={{ 
                              width: `${metro.metroReadinessIndex}%`,
                              background: getScoreColor(metro.metroReadinessIndex)
                            }}
                          />
                        </div>
                      </div>

                      {/* Score Breakdown */}
                      <div className="grid grid-cols-3 gap-2 mb-4 text-center">
                        <div className="bg-muted/50 rounded-lg py-2 px-1">
                          <p className="text-xs text-muted-foreground">{t('metros.card.anchor')}</p>
                          <p className="font-semibold text-sm">{metro.anchorScore}</p>
                        </div>
                        <div className="bg-muted/50 rounded-lg py-2 px-1">
                          <p className="text-xs text-muted-foreground">{t('metros.card.demand')}</p>
                          <p className="font-semibold text-sm">{metro.demandScore}</p>
                        </div>
                        <div className="bg-muted/50 rounded-lg py-2 px-1">
                          <p className="text-xs text-muted-foreground">{t('metros.card.ops')}</p>
                          <p className="font-semibold text-sm">{metro.opsScore}</p>
                        </div>
                      </div>

                      {/* Stats */}
                      <div className="flex items-center gap-4 text-sm mb-4">
                        <div className="flex items-center gap-1">
                          <Users className="w-4 h-4 text-primary" />
                          <span className="font-medium">{metro.activeAnchors}</span>
                          <span className="text-muted-foreground">{t('metros.card.anchors')}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <TrendingUp className="w-4 h-4 text-primary" />
                          <span className="font-medium">{metro.anchorsInPipeline}</span>
                          <span className="text-muted-foreground">{t('metros.card.pipeline')}</span>
                        </div>
                      </div>

                      {/* Recommendation */}
                      <div className="pt-3 border-t border-border flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">{t('metros.card.recommendation')}</span>
                        <span className={cn('status-badge px-3 py-1 rounded-md', getRecommendationBadge(metro.recommendation))}>
                          {metro.recommendation || 'Hold'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Delete Confirmation */}
      <AlertDialog open={!!metroToDelete} onOpenChange={(open) => !open && setMetroToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('metros.deleteDialog.title')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('metros.deleteDialog.description', { name: metroToDelete?.metro })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('metros.deleteDialog.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (metroToDelete) {
                  deleteMetro.mutate({ id: metroToDelete.id, name: metroToDelete.metro });
                  setMetroToDelete(null);
                }
              }}
            >
              {t('metros.deleteDialog.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Add Metro Dialog */}
      <Dialog open={showAddMetro} onOpenChange={setShowAddMetro}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('metros.addDialog.title')}</DialogTitle>
            <DialogDescription>{t('metros.addDialog.description')}</DialogDescription>
          </DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); handleCreateMetro(); }} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="new-metro-name">{t('metros.addDialog.metroName')}</Label>
              <Input
                id="new-metro-name"
                value={newMetroName}
                onChange={(e) => setNewMetroName(e.target.value)}
                placeholder={t('metros.addDialog.metroNamePlaceholder')}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-metro-region">{t('metros.addDialog.region')}</Label>
              <Select value={newMetroRegion} onValueChange={setNewMetroRegion}>
                <SelectTrigger>
                  <SelectValue placeholder={t('metros.addDialog.regionPlaceholder')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">
                    <span className="text-muted-foreground">{t('metros.addDialog.noRegion')}</span>
                  </SelectItem>
                  {(regions || []).map(region => (
                    <SelectItem key={region.id} value={region.id}>
                      <div className="flex items-center gap-2">
                        {region.color && (
                          <div
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: region.color }}
                          />
                        )}
                        {region.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowAddMetro(false)}>
                {t('metros.addDialog.cancel')}
              </Button>
              <Button type="submit" disabled={!newMetroName.trim() || createMetro.isPending}>
                {createMetro.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {createMetro.isPending ? t('metros.addDialog.creating') : t('metros.addDialog.create')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
