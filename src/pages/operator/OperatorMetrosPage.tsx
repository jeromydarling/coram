/**
 * OperatorMetrosPage — Full CRUD metros management for the Operator Console.
 *
 * WHAT: Lists all metros with search/filter, create dialog, edit (navigate), delete with confirmation.
 * WHERE: /operator/metros
 * WHY: Operators need global metro oversight without tenant scoping.
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMetrosWithComputed, useCreateMetro, useDeleteMetro, MetroWithComputed } from '@/hooks/useMetros';
import { useRegions } from '@/hooks/useRegions';
import { cn } from '@/lib/utils';
import {
  Search, MapPin, Users, TrendingUp, Filter, Loader2, Globe, Pencil, Trash2, Plus,
} from 'lucide-react';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';

export default function OperatorMetrosPage() {
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

  const handleCreateMetro = () => {
    if (!newMetroName.trim()) return;
    const metro_id = newMetroName.trim().toLowerCase().replace(/\s+/g, '_').substring(0, 20);
    createMetro.mutate(
      { metro_id, metro: newMetroName.trim(), region_id: newMetroRegion || undefined } as any,
      {
        onSuccess: () => {
          setNewMetroName('');
          setNewMetroRegion('');
          setShowAddMetro(false);
        },
      }
    );
  };

  const filteredMetros = (metros || []).filter((metro) => {
    const matchesSearch = metro.metro.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || metro.metroStatus === statusFilter;
    const matchesRegion =
      regionFilter === 'all' ||
      metro.region_id === regionFilter ||
      (regionFilter === 'unassigned' && !metro.region_id);
    return matchesSearch && matchesStatus && matchesRegion;
  });

  const groupedMetros = filteredMetros.reduce(
    (acc, metro) => {
      const regionName = metro.region?.name || 'Unassigned';
      if (!acc[regionName]) acc[regionName] = { region: metro.region, metros: [] };
      acc[regionName].metros.push(metro);
      return acc;
    },
    {} as Record<string, { region: MetroWithComputed['region']; metros: MetroWithComputed[] }>
  );

  const getStatusBadge = (status: MetroWithComputed['metroStatus']) => {
    const styles: Record<string, string> = {
      'Expansion Ready': 'status-expansion-ready',
      'Anchor Build': 'status-anchor-build',
      'Ecosystem Dev': 'status-ecosystem-dev',
    };
    return styles[status] || 'status-ecosystem-dev';
  };

  const getRecommendationBadge = (rec: MetroWithComputed['recommendation']) => {
    const styles: Record<string, string> = {
      Invest: 'recommendation-invest',
      'Build Anchors': 'recommendation-build',
      Hold: 'recommendation-hold',
      Triage: 'recommendation-triage',
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
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-destructive">Error loading metros: {error.message}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Metros</h1>
          <p className="text-sm text-muted-foreground">Market readiness and expansion planning</p>
        </div>
      </div>

      {/* Filters + Add */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between">
        <div className="flex gap-3 flex-1 flex-wrap">
          <div className="relative flex-1 min-w-[200px] max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Search metros..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9" />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40">
              <Filter className="w-4 h-4 mr-2" />
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="Expansion Ready">Expansion Ready</SelectItem>
              <SelectItem value="Anchor Build">Anchor Build</SelectItem>
              <SelectItem value="Ecosystem Dev">Ecosystem Dev</SelectItem>
            </SelectContent>
          </Select>
          <Select value={regionFilter} onValueChange={setRegionFilter}>
            <SelectTrigger className="w-44">
              <Globe className="w-4 h-4 mr-2" />
              <SelectValue placeholder="Region" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Regions</SelectItem>
              <SelectItem value="unassigned">Unassigned</SelectItem>
              {(regions || []).map((region) => (
                <SelectItem key={region.id} value={region.id}>{region.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button onClick={() => setShowAddMetro(true)} className="w-full sm:w-auto flex-shrink-0">
          <Plus className="w-4 h-4 mr-2" />
          Add Metro
        </Button>
      </div>

      {/* Metro Cards */}
      {filteredMetros.length === 0 ? (
        <div className="text-center py-12">
          <MapPin className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">No metros found</p>
        </div>
      ) : (
        <div className="space-y-8">
          {Object.entries(groupedMetros)
            .sort(([a], [b]) => (a === 'Unassigned' ? 1 : b === 'Unassigned' ? -1 : a.localeCompare(b)))
            .map(([regionName, { region, metros: regionMetros }]) => (
              <div key={regionName}>
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: region?.color || 'hsl(var(--muted-foreground))' }} />
                  <h2 className="text-lg font-semibold">{regionName}</h2>
                  <span className="text-sm text-muted-foreground">({regionMetros.length} metros)</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {regionMetros.map((metro, index) => (
                    <div
                      key={metro.id}
                      className={cn(
                        'bg-card rounded-xl border border-border p-5 hover:shadow-card-hover transition-all duration-200 cursor-pointer group',
                        `stagger-${(index % 6) + 1}`
                      )}
                    >
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-primary/10 rounded-lg">
                            <MapPin className="w-5 h-5 text-primary" />
                          </div>
                          <div>
                            <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors">{metro.metro}</h3>
                            <span className={cn('status-badge text-xs', getStatusBadge(metro.metroStatus))}>{metro.metroStatus}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={(e) => { e.stopPropagation(); }}
                            className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-primary transition-colors"
                            title="Edit metro"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); setMetroToDelete(metro); }}
                            className="p-1.5 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                            title="Delete metro"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      <div className="mb-4">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm text-muted-foreground">Readiness Index</span>
                          <span className="font-bold text-lg" style={{ color: getScoreColor(metro.metroReadinessIndex) }}>{metro.metroReadinessIndex}</span>
                        </div>
                        <div className="score-bar">
                          <div className="score-fill" style={{ width: `${metro.metroReadinessIndex}%`, background: getScoreColor(metro.metroReadinessIndex) }} />
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-2 mb-4 text-center">
                        <div className="bg-muted/50 rounded-lg py-2 px-1">
                          <p className="text-xs text-muted-foreground">Anchor</p>
                          <p className="font-semibold text-sm">{metro.anchorScore}</p>
                        </div>
                        <div className="bg-muted/50 rounded-lg py-2 px-1">
                          <p className="text-xs text-muted-foreground">Demand</p>
                          <p className="font-semibold text-sm">{metro.demandScore}</p>
                        </div>
                        <div className="bg-muted/50 rounded-lg py-2 px-1">
                          <p className="text-xs text-muted-foreground">Ops</p>
                          <p className="font-semibold text-sm">{metro.opsScore}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-4 text-sm mb-4">
                        <div className="flex items-center gap-1">
                          <Users className="w-4 h-4 text-primary" />
                          <span className="font-medium">{metro.activeAnchors}</span>
                          <span className="text-muted-foreground">anchors</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <TrendingUp className="w-4 h-4 text-primary" />
                          <span className="font-medium">{metro.anchorsInPipeline}</span>
                          <span className="text-muted-foreground">pipeline</span>
                        </div>
                      </div>

                      <div className="pt-3 border-t border-border flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Recommendation</span>
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

      {/* Delete Confirmation */}
      <AlertDialog open={!!metroToDelete} onOpenChange={(open) => !open && setMetroToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Metro</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{metroToDelete?.metro}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (metroToDelete) {
                  deleteMetro.mutate({ id: metroToDelete.id, name: metroToDelete.metro });
                  setMetroToDelete(null);
                }
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Add Metro Dialog */}
      <Dialog open={showAddMetro} onOpenChange={setShowAddMetro}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Metro</DialogTitle>
            <DialogDescription>Create a new metro area</DialogDescription>
          </DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); handleCreateMetro(); }} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="new-metro-name">Metro Name</Label>
              <Input id="new-metro-name" value={newMetroName} onChange={(e) => setNewMetroName(e.target.value)} placeholder="e.g. Kansas City" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-metro-region">Region</Label>
              <Select value={newMetroRegion} onValueChange={setNewMetroRegion}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a region (optional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none"><span className="text-muted-foreground">No region assigned</span></SelectItem>
                  {(regions || []).map((region) => (
                    <SelectItem key={region.id} value={region.id}>
                      <div className="flex items-center gap-2">
                        {region.color && <div className="w-3 h-3 rounded-full" style={{ backgroundColor: region.color }} />}
                        {region.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowAddMetro(false)}>Cancel</Button>
              <Button type="submit" disabled={!newMetroName.trim() || createMetro.isPending}>
                {createMetro.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Create Metro
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
